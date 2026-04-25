"""Request models — the contract Shawn's orchestrator sends to Layer 3."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TransactionType = Literal["qr_payment", "duitnow_transfer", "bill_payment"]


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
