"""SageMaker sklearn container inference handlers.

This file is packaged inside every user's .tar.gz artifact by train_and_export.py.
The SageMaker managed sklearn container calls these four functions automatically.

Contract:
  - model_fn     : load model from /opt/ml/model/
  - input_fn     : deserialise request body → numpy array
  - predict_fn   : run model.decision_function → float score
  - output_fn    : serialise score → JSON response body

Score semantics (must match risk_scorer._scale_ml):
  ~0.0  →  normal transaction
  < 0   →  anomalous (more negative = more anomalous)
"""
from __future__ import annotations

import json
import os

import joblib
import numpy as np


def model_fn(model_dir: str):
    """Load the IsolationForest from the model directory."""
    model_path = os.path.join(model_dir, "model.joblib")
    return joblib.load(model_path)


def input_fn(request_body: str | bytes, content_type: str = "application/json"):
    """Parse a JSON list of 12 floats into a (1, 12) numpy array."""
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")
    features = json.loads(request_body)
    return np.array(features, dtype=float).reshape(1, -1)


def predict_fn(X: np.ndarray, model):
    """Return the raw decision_function score as a Python float."""
    score = model.decision_function(X)[0]
    return float(score)


def output_fn(prediction: float, accept: str = "application/json") -> str:
    """Serialise the score to JSON."""
    return json.dumps(prediction)
