"""SageMaker Multi-Model Endpoint (MME) server — runs inside the Docker container.

Implements the SageMaker MME custom container HTTP API on port 8080:
  GET    /ping                      — health check
  POST   /models                    — load a model (SageMaker calls this lazily)
  GET    /models                    — list loaded models
  GET    /models/<name>             — model status
  DELETE /models/<name>             — evict a model from memory
  POST   /models/<name>/invoke      — run inference

SageMaker flow per request:
  1. Receives InvokeEndpoint(TargetModel="user_001.tar.gz")
  2. Downloads s3://bucket/models/user_001.tar.gz → extracts to local dir
  3. POST /models  {"model_name": "user_001.tar.gz", "url": "/opt/ml/models/user_001.tar.gz"}
  4. POST /models/user_001.tar.gz/invoke  body=[f1,f2,...,f12]
  5. Returns the float score back to the caller
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path

import joblib
import numpy as np
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

_models: dict[str, object] = {}
_lock = threading.Lock()


@app.get("/ping")
def ping():
    return jsonify({"status": "Healthy"}), 200


@app.post("/models")
def load_model():
    body = request.get_json(force=True)
    model_name: str = body["model_name"]
    url: str = body["url"]  # local path where SageMaker extracted the tar.gz

    model_path = Path(url) / "model.joblib"
    if not model_path.exists():
        logger.error("model.joblib not found at %s", model_path)
        return jsonify({"message": f"model.joblib not found at {model_path}"}), 404

    model = joblib.load(str(model_path))
    with _lock:
        _models[model_name] = model
    logger.info("Loaded model: %s", model_name)
    return jsonify({"modelName": model_name, "modelState": "LOADED"}), 200


@app.get("/models")
def list_models():
    with _lock:
        names = list(_models.keys())
    return jsonify({"models": [{"modelName": n, "modelState": "LOADED"} for n in names]}), 200


@app.get("/models/<path:model_name>")
def model_status(model_name: str):
    with _lock:
        exists = model_name in _models
    if not exists:
        return jsonify({"message": f"Model {model_name} not loaded"}), 404
    return jsonify({"modelName": model_name, "modelState": "LOADED"}), 200


@app.delete("/models/<path:model_name>")
def unload_model(model_name: str):
    with _lock:
        _models.pop(model_name, None)
    logger.info("Unloaded model: %s", model_name)
    return "", 200


@app.post("/models/<path:model_name>/invoke")
def invoke(model_name: str):
    with _lock:
        model = _models.get(model_name)
    if model is None:
        return jsonify({"message": f"Model {model_name} not loaded"}), 404

    try:
        features = json.loads(request.data)
        X = np.array(features, dtype=float).reshape(1, -1)
        score = float(model.decision_function(X)[0])
        return jsonify(score), 200
    except Exception as exc:
        logger.error("Inference error for %s: %s", model_name, exc)
        return jsonify({"message": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    logger.info("Starting MME server on port %d", port)
    app.run(host="0.0.0.0", port=port)
