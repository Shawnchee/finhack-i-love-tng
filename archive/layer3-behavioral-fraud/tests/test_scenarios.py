"""End-to-end scenario tests for the 4 demo personas.

Requires AWS credentials and S3_DATA_BUCKET + SAGEMAKER_ENDPOINT_NAME set —
TestClient triggers the lifespan which pulls data from S3 and routes ML
scoring to the SageMaker endpoint. Run against the real AWS environment only.

If any decision tier flips, something regressed.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _check(client: TestClient, body: dict) -> dict:
    r = client.post("/api/check_transaction", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _simulate(client: TestClient, user_id: str, amount: float, account: str, ts: str) -> None:
    r = client.post("/api/simulate_transaction", json={
        "user_id": user_id,
        "transaction": {
            "amount": amount,
            "recipient_account": account,
            "timestamp": ts,
            "transaction_type": "duitnow_transfer",
        },
    })
    assert r.status_code == 200, r.text


def test_wei_bubble_tea_allows(client):
    """Normal small QR payment to a known merchant type — must pass silently."""
    res = _check(client, {
        "user_id": "user_003",
        "recipient_account": "5554040001",
        "recipient_name": "Chatime",
        "amount": 18.00,
        "transaction_type": "qr_payment",
        "timestamp": "2026-04-22T15:30:00+08:00",
    })
    assert res["decision"] == "ALLOW"
    assert res["risk_score"] < 30


def test_wei_subtle_notify(client):
    """Small-ish amount but new recipient at an unusual hour — rules alone wouldn't
    hit NOTIFY; ML contribution should tip it into the NOTIFY band (30-59)."""
    res = _check(client, {
        "user_id": "user_003",
        "recipient_account": "9998887777",
        "recipient_name": "Unknown",
        "amount": 150.00,
        "transaction_type": "duitnow_transfer",
        "timestamp": "2026-04-22T03:00:00+08:00",
    })
    assert res["decision"] == "NOTIFY"
    assert 30 <= res["risk_score"] <= 59


def test_aisyah_love_scam_blocks(client):
    """Large late-night transfer to a brand-new account — four high-severity
    rules fire plus strong ML anomaly. Lands in BLOCK."""
    res = _check(client, {
        "user_id": "user_001",
        "recipient_account": "7779998888",
        "recipient_name": "David Lim",
        "amount": 4800.00,
        "transaction_type": "duitnow_transfer",
        "timestamp": "2026-04-22T23:47:00+08:00",
    })
    assert res["decision"] == "BLOCK"
    codes = {rc["code"] for rc in res["reason_codes"]}
    assert {"UNUSUAL_AMOUNT", "EXCEEDS_HISTORICAL_MAX", "NEW_RECIPIENT_LARGE_AMOUNT"} <= codes


def test_mak_timah_pdrm_scam_blocks(client):
    """Retiree being socially engineered — huge amount, new recipient, unusual hour."""
    res = _check(client, {
        "user_id": "user_004",
        "recipient_account": "8887776666",
        "recipient_name": "PDRM Officer",
        "amount": 8000.00,
        "transaction_type": "duitnow_transfer",
        "timestamp": "2026-04-22T20:00:00+08:00",
    })
    assert res["decision"] == "BLOCK"
    codes = {rc["code"] for rc in res["reason_codes"]}
    assert {"UNUSUAL_AMOUNT", "EXCEEDS_HISTORICAL_MAX", "NEW_RECIPIENT_LARGE_AMOUNT"} <= codes


def test_ahmad_rapid_velocity_blocks(client):
    """Phone-theft pattern: 4 simulated rapid transfers then a 5th candidate.
    Baseline cutoff must exclude the simulated cluster so amount/recipient stats
    stay 'established', letting UNUSUAL_AMOUNT + EXCEEDS_HISTORICAL_MAX +
    NEW_RECIPIENT_LARGE_AMOUNT + HIGH_VELOCITY all fire."""
    for i, ts in enumerate([
        "2026-04-22T13:52:00+08:00",
        "2026-04-22T13:54:00+08:00",
        "2026-04-22T13:56:00+08:00",
        "2026-04-22T13:58:00+08:00",
    ]):
        _simulate(client, "user_002", 2000.00, f"66612345{i:02d}", ts)

    res = _check(client, {
        "user_id": "user_002",
        "recipient_account": "6661234599",
        "recipient_name": "Stranger",
        "amount": 2000.00,
        "transaction_type": "duitnow_transfer",
        "timestamp": "2026-04-22T14:00:00+08:00",
    })
    assert res["decision"] == "BLOCK"
    codes = {rc["code"] for rc in res["reason_codes"]}
    assert "HIGH_VELOCITY" in codes
    assert {"UNUSUAL_AMOUNT", "EXCEEDS_HISTORICAL_MAX", "NEW_RECIPIENT_LARGE_AMOUNT"} <= codes
