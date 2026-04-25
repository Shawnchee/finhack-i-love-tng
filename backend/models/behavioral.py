from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Internal domain models (dataclasses, not exposed via API) ────────────────

TransactionType = Literal["qr_payment", "duitnow_transfer", "bill_payment"]


@dataclass
class Transaction:
    user_id: str
    recipient_account: str
    recipient_name: str
    amount: float
    transaction_type: str
    timestamp: datetime


@dataclass
class User:
    user_id: str
    name: str
    transactions: list[Transaction] = field(default_factory=list)


# ── API request models ───────────────────────────────────────────────────────

class CheckTransactionRequest(BaseModel):
    user_id: str
    recipient_account: str
    recipient_name: str
    amount: float = Field(..., gt=0)
    transaction_type: TransactionType
    timestamp: datetime


class SimulatedTransaction(BaseModel):
    amount: float = Field(..., gt=0)
    recipient_account: str
    timestamp: datetime
    transaction_type: TransactionType


class SimulateTransactionRequest(BaseModel):
    user_id: str
    transaction: SimulatedTransaction


# ── API response models ──────────────────────────────────────────────────────

class Decision(str, Enum):
    ALLOW = "ALLOW"
    NOTIFY = "NOTIFY"
    CHALLENGE = "CHALLENGE"
    BLOCK = "BLOCK"


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
