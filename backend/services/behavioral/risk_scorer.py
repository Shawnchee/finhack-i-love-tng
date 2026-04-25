"""Combines rule-based points + ML contribution into final risk score + Decision.

  final_risk_score = min(100, rule_based_score + ml_contribution)
  rule_based_score = sum(severity_points)  — HIGH=25 / MEDIUM=15 / LOW=7
  ml_contribution  = scale(ml_anomaly_score) -> 0-40

Decision thresholds:
  0-29   → ALLOW
  30-59  → NOTIFY
  60-84  → CHALLENGE
  85-100 → BLOCK
"""

from __future__ import annotations

from backend.models.behavioral import CheckTransactionResponse, Decision, ReasonCode, Severity

SEVERITY_POINTS = {
    Severity.HIGH: 25,
    Severity.MEDIUM: 15,
    Severity.LOW: 7,
}


def _decision_for(score: int) -> Decision:
    if score <= 29:
        return Decision.ALLOW
    if score <= 59:
        return Decision.NOTIFY
    if score <= 84:
        return Decision.CHALLENGE
    return Decision.BLOCK


def _scale_ml(anomaly_score: float) -> int:
    """Isolation Forest score_samples: more negative = more anomalous.
    Map -0.5 → 40 pts, 0.0 → 0 pts, >0 → 0 pts.
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
    if decision == Decision.CHALLENGE:
        top = [r.code for r in reasons if r.severity == Severity.HIGH][:2]
        if not top:
            top = [r.code for r in reasons[:2]]
        tail = f" ({', '.join(top)})" if top else ""
        return (
            f"This transaction looks unusual for your typical spending{tail}. Please confirm you meant to send this.",
            "Show confirmation modal requiring re-authentication.",
        )
    return (
        "This transaction matches multiple fraud patterns. Please contact TNG support before continuing.",
        "Hard block. Require contact with support.",
    )
