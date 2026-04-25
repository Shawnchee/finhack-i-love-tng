from __future__ import annotations

import logging

from backend.models.behavioral import (
    CheckTransactionRequest,
    CheckTransactionResponse,
    SimulateTransactionRequest,
    Transaction,
    User,
    UserProfileResponse,
)
from backend.services.behavioral import data_loader
from backend.services.behavioral import feature_engineering
from backend.services.behavioral import ml_model
from backend.services.behavioral import profile_builder
from backend.services.behavioral import risk_scorer
from backend.services.behavioral import rules_engine

logger = logging.getLogger(__name__)


class BehavioralService:
    def load(self) -> None:
        data_loader.load()
        logger.info("Loaded %d users into memory.", len(data_loader.all_user_ids()))

    def check_transaction(self, request: CheckTransactionRequest) -> CheckTransactionResponse:
        user = data_loader.get_user(request.user_id)
        if user is None:
            raise KeyError(request.user_id)

        txn = Transaction(
            user_id=request.user_id,
            recipient_account=request.recipient_account,
            recipient_name=request.recipient_name,
            amount=request.amount,
            transaction_type=request.transaction_type,
            timestamp=request.timestamp,
        )
        reasons = rules_engine.run_all(txn, user)
        prior = [t for t in user.transactions if t.timestamp < txn.timestamp]
        features = feature_engineering.build_feature_vector(txn, prior)
        ml_score = ml_model.score(request.user_id, features)
        risk, decision, warning, action = risk_scorer.score_transaction(reasons, ml_score)

        return CheckTransactionResponse(
            decision=decision,
            risk_score=risk,
            reason_codes=reasons,
            ml_anomaly_score=ml_score,
            user_friendly_warning=warning,
            recommended_action=action,
        )

    def get_user_profile(self, user_id: str) -> UserProfileResponse:
        user = data_loader.get_user(user_id)
        if user is None:
            raise KeyError(user_id)
        return UserProfileResponse(
            user_id=user.user_id,
            name=user.name,
            profile_summary=profile_builder.build_profile(user),
        )

    def simulate_transaction(self, request: SimulateTransactionRequest) -> UserProfileResponse:
        user = data_loader.get_user(request.user_id)
        if user is None:
            raise KeyError(request.user_id)

        data_loader.append_transaction(Transaction(
            user_id=request.user_id,
            recipient_account=request.transaction.recipient_account,
            recipient_name="(simulated)",
            amount=request.transaction.amount,
            transaction_type=request.transaction.transaction_type,
            timestamp=request.transaction.timestamp,
        ))
        return UserProfileResponse(
            user_id=user.user_id,
            name=user.name,
            profile_summary=profile_builder.build_profile(user),
        )
