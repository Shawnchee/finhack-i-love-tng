"""Response models — what Layer 3 returns to Shawn's orchestrator."""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Decision(str, Enum):
    ALLOW = "ALLOW"         # risk 0-39
    NOTIFY = "NOTIFY"       # risk 40-69
    CHALLENGE = "CHALLENGE" # risk 70-100


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReasonCode(BaseModel):
    code: str
    severity: Severity
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class CheckTransactionResponse(BaseModel):
    decision: Decision
    risk_score: int = Field(..., ge=0, le=100)
    reason_codes: list[ReasonCode]
    ml_anomaly_score: float
    user_friendly_warning: str
    recommended_action: str


class FrequentRecipient(BaseModel):
    account: str
    name: str
    count: int


class ProfileSummary(BaseModel):
    total_transactions: int
    avg_transaction_amount: float
    median_transaction_amount: float
    max_historical_amount: float
    typical_hours: list[int]
    typical_days: list[str]
    frequent_recipients: list[FrequentRecipient]
    transaction_types_distribution: dict[str, float]


class UserProfileResponse(BaseModel):
    user_id: str
    name: str
    profile_summary: ProfileSummary
