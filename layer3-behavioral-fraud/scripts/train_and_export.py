"""Train all per-user Isolation Forests locally and export to S3.

Run this script once (or whenever you re-generate training data) from the
layer3-behavioral-fraud/ directory:

    python -m scripts.train_and_export

Each user gets a .tar.gz artifact containing:
  model.joblib   — the fitted IsolationForest
  inference.py   — SageMaker sklearn container entry point

Artifacts are uploaded to:
  s3://{S3_MODEL_BUCKET}/models/{user_id}.tar.gz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS SETUP — complete these steps before running:

1. Install AWS CLI
   https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html

2. Configure credentials
   $ aws configure
   Enter: AWS Access Key ID, Secret Access Key, default region (e.g. ap-southeast-1)

3. Create an S3 bucket (must be in the same region as your SageMaker endpoint)
   $ aws s3 mb s3://your-bucket-name --region ap-southeast-1

4. Create an IAM role with these managed policies attached:
     - AmazonS3FullAccess  (or scope to your bucket)
     - AmazonSageMakerFullAccess
   Save the Role ARN — you'll need it for deploy_endpoint.py.

5. Set environment variables (or create a .env file — see .env.example):
     S3_MODEL_BUCKET=your-bucket-name
     AWS_REGION=ap-southeast-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
from __future__ import annotations

import io
import logging
import os
import sys
import tarfile
import tempfile
from pathlib import Path

import boto3
import joblib
import numpy as np
import sklearn
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest

# ── Path bootstrap so we can import app.* when run as a script ──────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from app.services import data_loader  # noqa: E402
from app.services.feature_engineering import build_feature_vector  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Hyper-parameters (must match ml_model.py) ────────────────────────────────
MIN_HISTORY = 20
N_ESTIMATORS = 100
SEED = 42

# ── sklearn version check ─────────────────────────────────────────────────────
_LOCAL_SKLEARN = sklearn.__version__
logger.info("Local sklearn version: %s", _LOCAL_SKLEARN)
logger.warning(
    "IMPORTANT: The SageMaker sklearn container version MUST match your local "
    "sklearn version (%s). When running deploy_endpoint.py, pick the container "
    "image that matches. Mismatches cause joblib deserialization errors at "
    "inference time. See: https://github.com/aws/sagemaker-python-sdk#sklearn-sagemaker-estimators",
    _LOCAL_SKLEARN,
)

# ── Config ────────────────────────────────────────────────────────────────────
S3_BUCKET = os.environ["S3_MODEL_BUCKET"]
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
S3_PREFIX = "models"
INFERENCE_SCRIPT = Path(__file__).parent / "inference.py"


def _train_model(user_id: str, transactions) -> IsolationForest | None:
    txns = sorted(transactions, key=lambda t: t.timestamp)
    if len(txns) < MIN_HISTORY:
        logger.info("Skipping %s — only %d transactions (min %d).", user_id, len(txns), MIN_HISTORY)
        return None
    rows = [build_feature_vector(txns[i], txns[:i]) for i in range(1, len(txns))]
    X = np.vstack(rows)
    model = IsolationForest(n_estimators=N_ESTIMATORS, contamination="auto", random_state=SEED)
    model.fit(X)
    logger.info("Trained %s on %d samples.", user_id, X.shape[0])
    return model


def _package_artifact(model: IsolationForest, user_id: str) -> bytes:
    """Return a .tar.gz bytes containing model.joblib + inference.py."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        # model.joblib
        model_buf = io.BytesIO()
        joblib.dump(model, model_buf)
        model_buf.seek(0)
        info = tarfile.TarInfo(name="model.joblib")
        info.size = len(model_buf.getvalue())
        model_buf.seek(0)
        tf.addfile(info, model_buf)

        # inference.py (entry point for SageMaker sklearn container)
        tf.add(str(INFERENCE_SCRIPT), arcname="inference.py")

    buf.seek(0)
    return buf.read()


def _upload(s3: object, artifact: bytes, user_id: str) -> str:
    key = f"{S3_PREFIX}/{user_id}.tar.gz"
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=artifact)
    s3_uri = f"s3://{S3_BUCKET}/{key}"
    logger.info("Uploaded %s → %s", user_id, s3_uri)
    return s3_uri


def main() -> None:
    logger.info("Loading training data from data/")
    data_loader.load()
    user_ids = data_loader.all_user_ids()
    logger.info("Found %d users.", len(user_ids))

    s3 = boto3.client("s3", region_name=AWS_REGION)

    trained = 0
    skipped = 0
    for uid in user_ids:
        user = data_loader.get_user(uid)
        if user is None:
            skipped += 1
            continue
        model = _train_model(uid, user.transactions)
        if model is None:
            skipped += 1
            continue
        artifact = _package_artifact(model, uid)
        _upload(s3, artifact, uid)
        trained += 1

    logger.info(
        "Done. %d models trained and uploaded to s3://%s/%s/   (%d skipped).",
        trained, S3_BUCKET, S3_PREFIX, skipped,
    )
    logger.info(
        "Next step: run  python -m scripts.deploy_endpoint  to create the "
        "SageMaker Multi-Model Endpoint."
    )


if __name__ == "__main__":
    main()
