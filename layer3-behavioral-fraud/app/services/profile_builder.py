"""Computes user profile summaries for the /api/user_profile endpoint."""
from __future__ import annotations

from collections import Counter
from statistics import mean, median
from typing import Hashable, TypeVar

from app.models.response import FrequentRecipient, ProfileSummary
from app.models.user import User

_DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_HOUR_COVERAGE = 0.80
_DAY_COVERAGE = 0.80
_MAX_FREQUENT_RECIPIENTS = 5

_T = TypeVar("_T", bound=Hashable)


def build_profile(user: User) -> ProfileSummary:
    tx = user.transactions
    if not tx:
        return ProfileSummary(
            total_transactions=0,
            avg_transaction_amount=0.0,
            median_transaction_amount=0.0,
            max_historical_amount=0.0,
            typical_hours=[],
            typical_days=[],
            frequent_recipients=[],
            transaction_types_distribution={},
        )

    amounts = [t.amount for t in tx]

    hour_counts: Counter[int] = Counter(t.timestamp.hour for t in tx)
    typical_hours = sorted(_top_by_coverage(hour_counts, _HOUR_COVERAGE))

    day_counts: Counter[int] = Counter(t.timestamp.weekday() for t in tx)
    typical_day_idx = sorted(_top_by_coverage(day_counts, _DAY_COVERAGE))
    typical_days = [_DAYS_OF_WEEK[i] for i in typical_day_idx]

    recipient_counts: Counter[tuple[str, str]] = Counter()
    for t in tx:
        recipient_counts[(t.recipient_account, t.recipient_name)] += 1
    frequent = [
        FrequentRecipient(account=acc, name=name, count=count)
        for (acc, name), count in recipient_counts.most_common(_MAX_FREQUENT_RECIPIENTS)
    ]

    type_counts: Counter[str] = Counter(t.transaction_type for t in tx)
    total = sum(type_counts.values())
    distribution = {ttype: round(count / total, 4) for ttype, count in type_counts.items()}

    return ProfileSummary(
        total_transactions=len(tx),
        avg_transaction_amount=round(mean(amounts), 2),
        median_transaction_amount=round(median(amounts), 2),
        max_historical_amount=round(max(amounts), 2),
        typical_hours=typical_hours,
        typical_days=typical_days,
        frequent_recipients=frequent,
        transaction_types_distribution=distribution,
    )


def _top_by_coverage(counts: Counter[_T], coverage: float) -> set[_T]:
    total = sum(counts.values())
    if total == 0:
        return set()
    top: set[_T] = set()
    running = 0
    for value, count in counts.most_common():
        top.add(value)
        running += count
        if running / total >= coverage:
            break
    return top
