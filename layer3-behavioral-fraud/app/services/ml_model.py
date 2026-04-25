"""ML scoring — delegates to the SageMaker Multi-Model Endpoint."""
from __future__ import annotations

import numpy as np

from app.services import sagemaker_client


def score(user_id: str, features: np.ndarray) -> float:
    return sagemaker_client.score(user_id, features)
