"""SageMaker Multi-Model Endpoint client for per-user Isolation Forest inference."""

from __future__ import annotations

import json
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

_ENDPOINT_NAME = os.environ.get("SAGEMAKER_ENDPOINT_NAME", "")
_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")

_runtime = None


def _get_runtime():
    global _runtime
    if _runtime is None:
        import boto3
        _runtime = boto3.client("sagemaker-runtime", region_name=_REGION)
    return _runtime


def score(user_id: str, features: np.ndarray) -> float:
    if not _ENDPOINT_NAME:
        logger.warning("SAGEMAKER_ENDPOINT_NAME not set — returning 0.0 for user %s.", user_id)
        return 0.0

    target_model = f"{user_id}.tar.gz"
    payload = json.dumps(features.tolist())

    try:
        response = _get_runtime().invoke_endpoint(
            EndpointName=_ENDPOINT_NAME,
            TargetModel=target_model,
            ContentType="application/json",
            Accept="application/json",
            Body=payload,
        )
        result = json.loads(response["Body"].read())
        if isinstance(result, list):
            return float(result[0])
        return float(result)
    except Exception as exc:
        exc_name = type(exc).__name__
        if "ModelError" in exc_name or "ValidationError" in exc_name:
            logger.info("No SageMaker model for user %s (TargetModel=%s): %s", user_id, target_model, exc)
        else:
            logger.warning("SageMaker invoke failed for user %s: %s — returning 0.0.", user_id, exc)
        return 0.0
