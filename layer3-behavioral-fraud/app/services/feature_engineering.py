"""Builds ML feature vectors from a transaction + the user's historical context.

Features (design doc section 4):
  amount, amount_zscore_vs_user, amount_ratio_to_user_avg,
  hour_of_day, day_of_week, is_weekend,
  days_since_last_transaction, recipient_is_new,
  transactions_last_1h, transactions_last_24h, amount_last_24h,
  transaction_type_encoded
"""
from __future__ import annotations

from datetime import timedelta
from statistics import mean, stdev
from typing import Sequence

import numpy as np

from app.models.user import Transaction

_TYPE_MAP = {"qr_payment": 0, "duitnow_transfer": 1, "bill_payment": 2}
FEATURE_COUNT = 12


def build_feature_vector(txn: Transaction, history: Sequence[Transaction]) -> np.ndarray:
    """Build the 12-feature ML input for `txn` given the user's prior `history`.

    `history` must contain only transactions strictly before `txn`. Empty or
    tiny history is fine — we fall back to safe defaults so training still runs.
    """
    amounts = [t.amount for t in history]
    user_mean = mean(amounts) if amounts else 0.0
    user_std = stdev(amounts) if len(amounts) >= 2 else 0.0
    safe_std = user_std if user_std > 0 else 1.0

    amount_z = (txn.amount - user_mean) / safe_std
    amount_ratio = (txn.amount / user_mean) if user_mean > 0 else 0.0

    hour = txn.timestamp.hour
    dow = txn.timestamp.weekday()
    is_weekend = 1 if dow >= 5 else 0

    if history:
        last_ts = max(t.timestamp for t in history)
        days_since = (txn.timestamp - last_ts).total_seconds() / 86400.0
    else:
        days_since = 0.0
    days_since = min(max(days_since, 0.0), 365.0)

    recipient_is_new = 0 if any(t.recipient_account == txn.recipient_account for t in history) else 1

    cutoff_1h = txn.timestamp - timedelta(hours=1)
    cutoff_24h = txn.timestamp - timedelta(hours=24)
    tx_1h = sum(1 for t in history if t.timestamp >= cutoff_1h)
    last_24h = [t for t in history if t.timestamp >= cutoff_24h]
    tx_24h = len(last_24h)
    amt_24h = sum(t.amount for t in last_24h)

    type_code = _TYPE_MAP.get(txn.transaction_type, 0)

    return np.array(
        [
            txn.amount,
            amount_z,
            amount_ratio,
            hour,
            dow,
            is_weekend,
            days_since,
            recipient_is_new,
            tx_1h,
            tx_24h,
            amt_24h,
            type_code,
        ],
        dtype=float,
    )
