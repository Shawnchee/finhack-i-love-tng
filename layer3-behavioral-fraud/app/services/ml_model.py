"""Per-user Isolation Forest registry.

On startup, trains one IsolationForest per user on their 90-day feature-engineered
history. Each user's model learns *their* normal. At inference, `decision_function`
returns ~0 for normal points and goes negative for anomalies — matching the scaler
in `risk_scorer._scale_ml` (negative → 0-40 risk points).
"""
from __future__ import annotations

import logging
from typing import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest

from app.models.user import User
from app.services.feature_engineering import build_feature_vector

logger = logging.getLogger(__name__)

MIN_HISTORY = 20
N_ESTIMATORS = 100
SEED = 42


class UserModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, IsolationForest] = {}

    def train_all(self, users: Iterable[User]) -> None:
        for user in users:
            txns = sorted(user.transactions, key=lambda t: t.timestamp)
            if len(txns) < MIN_HISTORY:
                logger.info(
                    "Skipping ML training for %s (%d txns < %d).",
                    user.user_id, len(txns), MIN_HISTORY,
                )
                continue
            rows = [build_feature_vector(txns[i], txns[:i]) for i in range(1, len(txns))]
            X = np.vstack(rows)
            model = IsolationForest(
                n_estimators=N_ESTIMATORS,
                contamination="auto",
                random_state=SEED,
            )
            model.fit(X)
            self._models[user.user_id] = model
            logger.info("Trained Isolation Forest for %s on %d samples.", user.user_id, X.shape[0])

    def score(self, user_id: str, features: np.ndarray) -> float:
        """Return anomaly score: ~0 normal, negative anomalous. 0.0 if no model."""
        model = self._models.get(user_id)
        if model is None:
            return 0.0
        return float(model.decision_function(features.reshape(1, -1))[0])

    def has_model(self, user_id: str) -> bool:
        return user_id in self._models


registry = UserModelRegistry()
