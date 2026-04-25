"""Deploy (or update) the SageMaker Multi-Model Endpoint for per-user IF inference.

Run once after train_and_export.py has populated s3://{S3_MODEL_BUCKET}/models/:

    python -m scripts.deploy_endpoint

The script is idempotent — if the endpoint already exists it prints its status
and exits without making changes. Delete it manually via the AWS console or CLI
before re-running if you need to change instance type / container image.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AWS SETUP — complete these steps before running:

1. Install AWS CLI + configure credentials  (see train_and_export.py header)

2. Create an IAM execution role for SageMaker with:
     - AmazonS3FullAccess  (or a scoped policy for your bucket)
     - AmazonSageMakerFullAccess
   Console: IAM → Roles → Create role → AWS service → SageMaker
   Attach the policies above, then copy the Role ARN.

3. Set environment variables (or .env file — see .env.example):
     S3_MODEL_BUCKET=your-bucket-name
     SAGEMAKER_ROLE_ARN=arn:aws:iam::123456789012:role/YourSageMakerRole
     SAGEMAKER_ENDPOINT_NAME=layer3-isolation-forest-mme   (or any name you like)
     AWS_REGION=ap-southeast-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SKLEARN VERSION NOTE:
  The container image URI is resolved from SKLEARN_VERSION below.
  It must exactly match the sklearn version used during training (train_and_export.py
  printed a warning with your local version). Mismatches cause inference failures.

  Supported versions for the SageMaker sklearn framework container:
    0.23-1, 0.23-2, 1.0-1, 1.2-1, 1.3-1
  Check latest: https://github.com/aws/sagemaker-python-sdk#sklearn-sagemaker-estimators

  If your local sklearn is 1.5.x, use SKLEARN_VERSION = "1.3-1" (closest stable release
  available in the managed container as of this writing). Alternatively build a custom
  container from the official SageMaker scikit-learn container repo.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
S3_BUCKET = os.environ["S3_MODEL_BUCKET"]
ROLE_ARN = os.environ["SAGEMAKER_ROLE_ARN"]
ENDPOINT_NAME = os.environ.get("SAGEMAKER_ENDPOINT_NAME", "layer3-isolation-forest-mme")
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
S3_MODEL_URI = f"s3://{S3_BUCKET}/models/"

# ── Container image ────────────────────────────────────────────────────────────
# Custom inference image pushed to your own ECR by scripts/build_push_ecr.ps1.
CONTAINER_IMAGE = "940278683083.dkr.ecr.ap-southeast-1.amazonaws.com/layer3/sklearn:latest"
INSTANCE_TYPE = "ml.t2.medium"   # cheapest for demo; scale up for production



def _endpoint_exists(sm: object, name: str) -> bool:
    try:
        resp = sm.describe_endpoint(EndpointName=name)
        status = resp["EndpointStatus"]
        logger.info("Endpoint '%s' already exists with status: %s", name, status)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ValidationException":
            return False
        raise


def _wait_for_endpoint(sm: object, name: str, timeout_s: int = 600) -> str:
    logger.info("Waiting for endpoint '%s' to be InService (timeout %ds)…", name, timeout_s)
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        resp = sm.describe_endpoint(EndpointName=name)
        status = resp["EndpointStatus"]
        if status == "InService":
            logger.info("Endpoint '%s' is InService.", name)
            return status
        if status in ("Failed", "OutOfService"):
            reason = resp.get("FailureReason", "unknown")
            raise RuntimeError(f"Endpoint '{name}' entered status {status}: {reason}")
        logger.info("  status=%s — sleeping 15s…", status)
        time.sleep(15)
    raise TimeoutError(f"Endpoint '{name}' not InService within {timeout_s}s.")


def main() -> None:
    sm = boto3.client("sagemaker", region_name=AWS_REGION)

    if _endpoint_exists(sm, ENDPOINT_NAME):
        logger.info(
            "Endpoint already exists. No changes made.\n"
            "To redeploy: delete the endpoint via AWS console or:\n"
            "  aws sagemaker delete-endpoint --endpoint-name %s", ENDPOINT_NAME
        )
        return

    image_uri = CONTAINER_IMAGE
    logger.info("Container image: %s", image_uri)

    model_name = f"{ENDPOINT_NAME}-model"
    config_name = f"{ENDPOINT_NAME}-config"

    # 1. Create SageMaker Model with MultiModel=True
    logger.info("Creating SageMaker Model '%s'…", model_name)
    sm.create_model(
        ModelName=model_name,
        ExecutionRoleArn=ROLE_ARN,
        Containers=[
            {
                "Image": image_uri,
                "ModelDataUrl": S3_MODEL_URI,
                "Mode": "MultiModel",
                "Environment": {
                    "SAGEMAKER_PROGRAM": "inference.py",
                },
            }
        ],
    )

    # 2. Create EndpointConfig
    logger.info("Creating EndpointConfig '%s' on %s…", config_name, INSTANCE_TYPE)
    sm.create_endpoint_config(
        EndpointConfigName=config_name,
        ProductionVariants=[
            {
                "VariantName": "AllTraffic",
                "ModelName": model_name,
                "InitialInstanceCount": 1,
                "InstanceType": INSTANCE_TYPE,
            }
        ],
    )

    # 3. Create Endpoint
    logger.info("Creating Endpoint '%s'…", ENDPOINT_NAME)
    sm.create_endpoint(
        EndpointName=ENDPOINT_NAME,
        EndpointConfigName=config_name,
    )

    _wait_for_endpoint(sm, ENDPOINT_NAME)

    logger.info(
        "\nSageMaker Multi-Model Endpoint is live.\n"
        "Set these env vars on your FastAPI service before starting:\n"
        "  USE_SAGEMAKER=true\n"
        "  SAGEMAKER_ENDPOINT_NAME=%s\n"
        "  AWS_REGION=%s",
        ENDPOINT_NAME, AWS_REGION,
    )


if __name__ == "__main__":
    main()
