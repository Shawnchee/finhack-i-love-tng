"""Loads data from S3 into memory on startup.

Single source of truth at runtime. Mutations from /api/simulate_transaction
happen in-memory only (nothing is persisted back to S3).

Expects s3://{S3_DATA_BUCKET}/data/users.json and
         s3://{S3_DATA_BUCKET}/data/transactions.json
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime

import boto3

from app.models.user import Transaction, User

logger = logging.getLogger(__name__)

_S3_DATA_PREFIX = "data"

_users: dict[str, User] = {}


def load() -> None:
    """Pull users + transactions from S3 and load into memory."""
    global _users

    bucket = os.environ.get("S3_DATA_BUCKET", "")
    if not bucket:
        raise RuntimeError("S3_DATA_BUCKET environment variable is not set.")
    region = os.environ.get("AWS_REGION", "ap-southeast-1")
    s3 = boto3.client("s3", region_name=region)

    logger.info("Pulling data from s3://%s/%s/", bucket, _S3_DATA_PREFIX)
    users_raw = json.loads(
        s3.get_object(Bucket=bucket, Key=f"{_S3_DATA_PREFIX}/users.json")["Body"].read()
    )
    tx_raw = json.loads(
        s3.get_object(Bucket=bucket, Key=f"{_S3_DATA_PREFIX}/transactions.json")["Body"].read()
    )

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
