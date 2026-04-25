"""FastAPI app — Layer 3 Behavioral Fraud Detection."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models.request import CheckTransactionRequest, SimulateTransactionRequest
from app.models.response import CheckTransactionResponse, UserProfileResponse
from app.models.user import Transaction
from app.services import data_loader
from app.services.feature_engineering import build_feature_vector
from app.services.ml_model import registry as ml_registry
from app.services.profile_builder import build_profile
from app.services.risk_scorer import score_transaction
from app.services.rules_engine import run_all as run_rules

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    data_loader.load()
    logger.info("Loaded %d users into memory.", len(data_loader.all_user_ids()))
    users = [data_loader.get_user(uid) for uid in data_loader.all_user_ids()]
    ml_registry.train_all([u for u in users if u is not None])
    yield
    logger.info("Layer 3 shutting down.")


app = FastAPI(
    title="Layer 3 — Behavioral Fraud Detection",
    description=(
        "Per-user behavioral anomaly detection for TNG transactions. "
        "Hybrid rules + Isolation Forest pipeline. Returns risk score (0-100), "
        "decision (ALLOW/NOTIFY/CHALLENGE/BLOCK), and explainable reason codes."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/check_transaction", response_model=CheckTransactionResponse)
async def check_transaction(body: CheckTransactionRequest) -> CheckTransactionResponse:
    user = data_loader.get_user(body.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {body.user_id}")

    txn = Transaction(
        user_id=body.user_id,
        recipient_account=body.recipient_account,
        recipient_name=body.recipient_name,
        amount=body.amount,
        transaction_type=body.transaction_type,
        timestamp=body.timestamp,
    )
    reasons = run_rules(txn, user)
    prior = [t for t in user.transactions if t.timestamp < txn.timestamp]
    features = build_feature_vector(txn, prior)
    ml_score = ml_registry.score(body.user_id, features)
    risk, decision, warning, action = score_transaction(reasons, ml_score)

    return CheckTransactionResponse(
        decision=decision,
        risk_score=risk,
        reason_codes=reasons,
        ml_anomaly_score=ml_score,
        user_friendly_warning=warning,
        recommended_action=action,
    )


@app.get("/api/user_profile/{user_id}", response_model=UserProfileResponse)
async def user_profile(user_id: str) -> UserProfileResponse:
    user = data_loader.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {user_id}")
    return UserProfileResponse(
        user_id=user.user_id,
        name=user.name,
        profile_summary=build_profile(user),
    )


@app.post("/api/simulate_transaction", response_model=UserProfileResponse)
async def simulate_transaction(body: SimulateTransactionRequest) -> UserProfileResponse:
    user = data_loader.get_user(body.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {body.user_id}")

    data_loader.append_transaction(Transaction(
        user_id=body.user_id,
        recipient_account=body.transaction.recipient_account,
        recipient_name="(simulated)",
        amount=body.transaction.amount,
        transaction_type=body.transaction.transaction_type,
        timestamp=body.transaction.timestamp,
    ))

    return UserProfileResponse(
        user_id=user.user_id,
        name=user.name,
        profile_summary=build_profile(user),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8083, reload=True)
