"""Rule-based fraud checks against user transaction history.

Rules:
  UNUSUAL_AMOUNT             — amount > 5x rolling 30-day avg               (HIGH)
  EXCEEDS_HISTORICAL_MAX     — amount > 1.5x user's historical max          (HIGH)
  NEW_RECIPIENT_LARGE_AMOUNT — first-time recipient AND amount > RM1000     (HIGH)
  NEW_RECIPIENT              — recipient account never seen before           (MEDIUM)
  UNUSUAL_TIME               — hour not in user's top-80% active hours      (LOW)
  HIGH_VELOCITY              — >3 transactions in last 10 minutes           (MEDIUM)
  ROUND_AMOUNT               — exact RM500/1000/2000/5000/10000             (LOW)
  DORMANT_REACTIVATION       — no activity in 30d, now a large transfer     (HIGH)
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from statistics import mean

from backend.models.behavioral import ReasonCode, Severity, Transaction, User

ROUND_AMOUNTS = {500.0, 1000.0, 2000.0, 5000.0, 10000.0}
LARGE_AMOUNT_THRESHOLD = 1000.0
AMOUNT_SPIKE_MULTIPLIER = 5.0
HISTORICAL_MAX_MULTIPLIER = 1.5
VELOCITY_WINDOW_MIN = 10
VELOCITY_THRESHOLD = 3
DORMANT_DAYS = 30
DORMANT_AMOUNT_THRESHOLD = 500.0
UNUSUAL_HOUR_COVERAGE = 0.80
# Transactions within this window are excluded from baseline stats
# to avoid rapid-fire scam txns inflating the user average.
BASELINE_CUTOFF_HOURS = 1.0


def _rolling_avg(history: list[Transaction], now: datetime, days: int = 30) -> float:
    cutoff = now - timedelta(days=days)
    recent = [t.amount for t in history if t.timestamp >= cutoff]
    return mean(recent) if recent else 0.0


def _historical_max(history: list[Transaction]) -> float:
    return max((t.amount for t in history), default=0.0)


def _seen_recipient(history: list[Transaction], account: str) -> bool:
    return any(t.recipient_account == account for t in history)


def _user_top_hours(history: list[Transaction], coverage: float) -> set[int]:
    if not history:
        return set()
    counts = Counter(t.timestamp.hour for t in history)
    total = sum(counts.values())
    sorted_hours = sorted(counts.items(), key=lambda x: -x[1])
    top: set[int] = set()
    running = 0
    for h, c in sorted_hours:
        top.add(h)
        running += c
        if running / total >= coverage:
            break
    return top


def _transactions_in_window(history: list[Transaction], now: datetime, minutes: int) -> int:
    cutoff = now - timedelta(minutes=minutes)
    return sum(1 for t in history if t.timestamp >= cutoff)


def _days_since_last(history: list[Transaction], now: datetime) -> float:
    if not history:
        return float("inf")
    last = max(t.timestamp for t in history)
    return (now - last).total_seconds() / 86400.0


def run_all(txn: Transaction, user: User) -> list[ReasonCode]:
    now = txn.timestamp
    all_prior = [t for t in user.transactions if t.timestamp < now]

    baseline_cutoff = now - timedelta(hours=BASELINE_CUTOFF_HOURS)
    established = [t for t in all_prior if t.timestamp < baseline_cutoff]

    reasons: list[ReasonCode] = []

    avg30 = _rolling_avg(established, now, days=30)
    max_hist = _historical_max(established)
    is_new_recipient = not _seen_recipient(established, txn.recipient_account)
    top_hours = _user_top_hours(established, UNUSUAL_HOUR_COVERAGE)
    velocity = _transactions_in_window(all_prior, now, VELOCITY_WINDOW_MIN)
    days_dormant = _days_since_last(all_prior, now)

    if avg30 > 0 and txn.amount > AMOUNT_SPIKE_MULTIPLIER * avg30:
        reasons.append(ReasonCode(
            code="UNUSUAL_AMOUNT",
            severity=Severity.HIGH,
            message=f"This transfer is {txn.amount / avg30:.1f}x larger than your typical transaction",
            details={
                "transaction_amount": txn.amount,
                "user_avg_amount": round(avg30, 2),
                "user_max_historical": round(max_hist, 2),
            },
        ))

    if max_hist > 0 and txn.amount > HISTORICAL_MAX_MULTIPLIER * max_hist:
        reasons.append(ReasonCode(
            code="EXCEEDS_HISTORICAL_MAX",
            severity=Severity.HIGH,
            message=f"This is larger than any transaction in your 90-day history (previous max: RM{max_hist:.2f})",
            details={
                "transaction_amount": txn.amount,
                "historical_max": round(max_hist, 2),
            },
        ))

    if is_new_recipient and txn.amount > LARGE_AMOUNT_THRESHOLD:
        reasons.append(ReasonCode(
            code="NEW_RECIPIENT_LARGE_AMOUNT",
            severity=Severity.HIGH,
            message=f"You've never sent money to this account before, and this is a large amount (RM{txn.amount:.2f})",
            details={
                "recipient_account": txn.recipient_account,
                "transaction_amount": txn.amount,
            },
        ))
    elif is_new_recipient:
        reasons.append(ReasonCode(
            code="NEW_RECIPIENT",
            severity=Severity.MEDIUM,
            message="You've never transferred to this account before",
            details={
                "recipient_account": txn.recipient_account,
                "first_seen": True,
            },
        ))

    if top_hours and txn.timestamp.hour not in top_hours:
        typical = sorted(top_hours)
        reasons.append(ReasonCode(
            code="UNUSUAL_TIME",
            severity=Severity.LOW,
            message="You usually don't transact at this hour",
            details={
                "transaction_hour": txn.timestamp.hour,
                "user_typical_hours": f"{typical[0]:02d}:00-{typical[-1]:02d}:00",
            },
        ))

    if velocity >= VELOCITY_THRESHOLD:
        reasons.append(ReasonCode(
            code="HIGH_VELOCITY",
            severity=Severity.MEDIUM,
            message=f"{velocity + 1} transactions in the last {VELOCITY_WINDOW_MIN} minutes is unusual",
            details={
                "transactions_in_window": velocity + 1,
                "window_minutes": VELOCITY_WINDOW_MIN,
            },
        ))

    if txn.amount in ROUND_AMOUNTS:
        reasons.append(ReasonCode(
            code="ROUND_AMOUNT",
            severity=Severity.LOW,
            message=f"RM{int(txn.amount)} is a common scam amount",
            details={"transaction_amount": txn.amount},
        ))

    if days_dormant > DORMANT_DAYS and txn.amount > DORMANT_AMOUNT_THRESHOLD:
        reasons.append(ReasonCode(
            code="DORMANT_REACTIVATION",
            severity=Severity.HIGH,
            message=f"This is your first transaction in {int(days_dormant)} days and it's a large amount",
            details={
                "days_since_last_transaction": round(days_dormant, 1),
                "transaction_amount": txn.amount,
            },
        ))

    return reasons
