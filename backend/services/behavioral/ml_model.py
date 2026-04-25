from __future__ import annotations

import numpy as np

from backend.services.behavioral import sagemaker_client


def score(user_id: str, features: np.ndarray) -> float:
    return sagemaker_client.score(user_id, features)
