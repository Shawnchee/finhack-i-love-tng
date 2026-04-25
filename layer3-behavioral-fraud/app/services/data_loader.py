"""Loads synthetic data into memory on startup.

Single source of truth at runtime. Mutations from /api/simulate_transaction
happen in-memory only (nothing is persisted back to disk).
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app.models.user import Transaction, User

_DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

_users: dict[str, User] = {}


def load(data_dir: Path | None = None) -> None:
    """Read users.json + transactions.json into memory."""
    global _users
    d = data_dir or _DEFAULT_DATA_DIR

    users_raw = json.loads((d / "users.json").read_text(encoding="utf-8"))
    tx_raw = json.loads((d / "transactions.json").read_text(encoding="utf-8"))

    _users = {
        uid: User(user_id=uid, name=info["name"])
        for uid, info in users_raw.items()
    }
    for t in tx_raw:
        uid = t["user_id"]
        if uid not in _users:
            continue
        _users[uid].transactions.append(Transaction(
            user_id=uid,
            recipient_account=t["recipient_account"],
            recipient_name=t["recipient_name"],
            amount=float(t["amount"]),
            transaction_type=t["transaction_type"],
            timestamp=datetime.fromisoformat(t["timestamp"]),
        ))
    for u in _users.values():
        u.transactions.sort(key=lambda x: x.timestamp)


def get_user(user_id: str) -> User | None:
    return _users.get(user_id)


def all_user_ids() -> list[str]:
    return list(_users.keys())


def append_transaction(t: Transaction) -> None:
    user = _users.get(t.user_id)
    if user is None:
        raise KeyError(t.user_id)
    user.transactions.append(t)
    user.transactions.sort(key=lambda x: x.timestamp)
