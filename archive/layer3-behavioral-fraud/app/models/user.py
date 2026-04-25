"""Internal domain models — users and transactions held in memory."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


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
