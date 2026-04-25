"""Combines rule-based points + ML contribution into final risk score + Decision.

    final_risk_score = min(100, rule_based_score + ml_contribution)
    rule_based_score = sum(severity_points for triggered rules)  # high=25 / med=15 / low=7
    ml_contribution  = scale(ml_anomaly_score) -> 0-40

Decision thresholds:
    0-39   -> ALLOW
    40-69  -> NOTIFY
    70-100 -> CHALLENGE  (re-auth required, transaction still goes through)
"""
from __future__ import annotations

from app.models.response import Decision, ReasonCode, Severity

SEVERITY_POINTS = {
    Severity.HIGH: 25,
    Severity.MEDIUM: 15,
    Severity.LOW: 7,
}


def _decision_for(score: int) -> Decision:
    if score <= 39:
        return Decision.ALLOW
    if score <= 69:
        return Decision.NOTIFY
    return Decision.CHALLENGE


def _scale_ml(anomaly_score: float) -> int:
    """Isolation Forest `score_samples` returns roughly [-0.5, 0.5]; more negative = more anomalous.

    Map -0.5 -> 40 points, 0.0 -> 0 points, >0 -> 0 points.
    """
    if anomaly_score >= 0:
        return 0
    return min(40, max(0, int(-anomaly_score * 80)))


def score_transaction(
    reason_codes: list[ReasonCode],
    ml_anomaly_score: float = 0.0,
) -> tuple[int, Decision, str, str]:
    rule_points = sum(SEVERITY_POINTS[rc.severity] for rc in reason_codes)
    ml_points = _scale_ml(ml_anomaly_score)
    total = min(100, rule_points + ml_points)
    decision = _decision_for(total)
    warning, action = _narrative(decision, reason_codes)
    return total, decision, warning, action


def _narrative(decision: Decision, reasons: list[ReasonCode]) -> tuple[str, str]:
    if decision == Decision.ALLOW:
        return (
            "This transaction looks consistent with your typical spending.",
            "Allow silently.",
        )
    if decision == Decision.NOTIFY:
        return (
            "This transaction is slightly outside your normal pattern. We let it through — double-check it.",
            "Show a post-transaction notice.",
        )
    # CHALLENGE
    top = [r.code for r in reasons if r.severity == Severity.HIGH][:2]
    if not top:
        top = [r.code for r in reasons[:2]]
    tail = f" ({', '.join(top)})" if top else ""
    return (
        f"This transaction looks unusual for your typical spending{tail}. Please verify it's really you before proceeding.",
        "Show confirmation modal requiring re-authentication. Transaction proceeds on success.",
    )
