# Layer 3 — Behavioral Fraud Detection

TNG FinHack 2026. Per-user behavioral anomaly detection.

Given a candidate transaction, returns a risk score (0-100), a decision (`ALLOW | NOTIFY | CHALLENGE | BLOCK`), and explainable reason codes. Hybrid pipeline: deterministic rules + per-user Isolation Forest.

> One of three backend services in the [Semak](../README.md) project. Runs alongside [`mule_check_api`](../mule_check_api/) (NFP + SemakMule registry checks) and [`fraud_detect_api`](../fraud_detect_api/) (URL scraping + scam-keyword matching). The frontend at [`/check`](../frontend/src/pages/Check.tsx) calls this endpoint via the "Add transaction details" disclosure when a bank account is provided.

---

## How scoring works

**Rules and ML both run on every transaction.** Their scores add:

```
final_risk_score = min(100, rule_points + ml_points)
```

| Layer                 | Contributes | Catches |
|-----------------------|-------------|---------|
| Rules                 | 0-100       | Obvious, threshold-based fraud (amount spikes, new recipient + large amount, velocity, dormancy) |
| ML (Isolation Forest) | 0-40        | Subtle combinations — no single rule screams, but the joint pattern is unusual for *this* user |

Rule severity points: **high = 25, medium = 15, low = 7.** ML capped at 40 so it can tip a borderline case into `NOTIFY` but can never push to `CHALLENGE`/`BLOCK` without rules agreeing — a safety valve if the model misbehaves.

Baseline stats (avg, max, seen-recipients, typical hours) exclude transactions from the **last hour** so rapid-fire fraud clusters don't pollute the user's "normal" profile.

One `IsolationForest` is trained per user on startup from their 90-day history (12 features: amount z-score, amount ratio, hour, day-of-week, is-weekend, days-since-last, recipient-is-new, tx-count last 1h/24h, amount last 24h, tx-type). Users with fewer than 20 historical transactions skip training and get `ml_score = 0`.

### Decision tiers

| Score   | Decision    | Frontend action |
|---------|-------------|-----------------|
| 0-29    | `ALLOW`     | Silent pass |
| 30-59   | `NOTIFY`    | Post-transaction banner ("completed, but larger than usual") |
| 60-84   | `CHALLENGE` | Modal — require re-auth (PIN / face) before proceeding |
| 85-100  | `BLOCK`     | Hard block. Tell user to contact support. |

---

## API

Base URL: `http://localhost:8083` · Swagger: `/docs` · CORS: open (`*`)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health`                  | Liveness — returns `{"status":"ok"}` |
| `POST` | `/api/check_transaction`       | Score a transaction |
| `GET`  | `/api/user_profile/{user_id}`  | Behavioral baseline (for the "your normal pattern" panel) |
| `POST` | `/api/simulate_transaction`    | Demo-only — inject a tx into user history |

### `POST /api/check_transaction`

**Request**
```json
{
  "user_id": "user_001",
  "recipient_account": "1234567890",
  "recipient_name": "Ali Bin Abu",
  "amount": 5000.00,
  "transaction_type": "duitnow_transfer",
  "timestamp": "2026-04-26T23:47:00+08:00"
}
```

- `transaction_type` ∈ `"qr_payment" | "duitnow_transfer" | "bill_payment"`
- `timestamp` ISO 8601 **with timezone** (use `+08:00` for MYT)

**Response shape**
```ts
{
  decision: "ALLOW" | "NOTIFY" | "CHALLENGE" | "BLOCK";
  risk_score: number;                   // 0-100
  reason_codes: {
    code: string;                       // see Reason codes table below
    severity: "low" | "medium" | "high";
    message: string;                    // ready to render
    details: Record<string, any>;       // diagnostics, for debugging
  }[];
  ml_anomaly_score: number;             // raw IF score, more negative = more anomalous
  user_friendly_warning: string;        // one-line copy for the modal/banner
  recommended_action: string;           // human-readable hint
}
```

**Sample — `ALLOW`** (Wei RM80 bubble tea — normal)
```json
{
  "decision": "ALLOW",
  "risk_score": 0,
  "reason_codes": [],
  "ml_anomaly_score": 0.0,
  "user_friendly_warning": "This transaction looks consistent with your typical spending.",
  "recommended_action": "Allow silently."
}
```

**Sample — `CHALLENGE`** (Mak Timah RM8000 to new account @ 20:00 Thu)
```json
{
  "decision": "CHALLENGE",
  "risk_score": 82,
  "reason_codes": [
    { "code": "UNUSUAL_AMOUNT", "severity": "high",
      "message": "This transfer is 98.0x larger than your typical transaction",
      "details": { "transaction_amount": 8000.0, "user_avg_amount": 81.63, "user_max_historical": 145.76 } },
    { "code": "EXCEEDS_HISTORICAL_MAX", "severity": "high", "message": "...", "details": { } },
    { "code": "NEW_RECIPIENT_LARGE_AMOUNT", "severity": "high", "message": "...", "details": { } },
    { "code": "UNUSUAL_TIME", "severity": "low", "message": "...", "details": { } }
  ],
  "ml_anomaly_score": 0.0,
  "user_friendly_warning": "This transaction looks unusual for your typical spending (UNUSUAL_AMOUNT, EXCEEDS_HISTORICAL_MAX). Please confirm you meant to send this.",
  "recommended_action": "Show confirmation modal requiring re-authentication."
}
```

**Sample — `BLOCK`** (Ahmad — 5 rapid RM2000 transfers)
```json
{
  "decision": "BLOCK",
  "risk_score": 97,
  "reason_codes": [
    { "code": "UNUSUAL_AMOUNT",             "severity": "high",   "...": "..." },
    { "code": "EXCEEDS_HISTORICAL_MAX",     "severity": "high",   "...": "..." },
    { "code": "NEW_RECIPIENT_LARGE_AMOUNT", "severity": "high",   "...": "..." },
    { "code": "HIGH_VELOCITY",              "severity": "medium", "...": "..." },
    { "code": "ROUND_AMOUNT",               "severity": "low",    "...": "..." }
  ],
  "ml_anomaly_score": 0.0,
  "user_friendly_warning": "This transaction matches multiple fraud patterns. Please contact TNG support before continuing.",
  "recommended_action": "Hard block. Require contact with support."
}
```

`NOTIFY` responses follow the same shape with 1-2 reason codes. Explore any response interactively at [`/docs`](http://localhost:8083/docs).

### `GET /api/user_profile/{user_id}`

**Response**
```json
{
  "user_id": "user_001",
  "name": "Aisyah",
  "profile_summary": {
    "total_transactions": 287,
    "avg_transaction_amount": 136.42,
    "median_transaction_amount": 120.45,
    "max_historical_amount": 1206.64,
    "typical_hours": [9, 12, 14, 17, 18, 19, 20, 21],
    "typical_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "frequent_recipients": [
      { "account": "5551234004", "name": "Pressto Laundry", "count": 41 }
    ],
    "transaction_types_distribution": {
      "qr_payment": 0.6237, "duitnow_transfer": 0.2509, "bill_payment": 0.1254
    }
  }
}
```

### `POST /api/simulate_transaction`

Appends a transaction to the user's in-memory history (never persisted to disk). Response shape is identical to `/api/user_profile`.

**Request**
```json
{
  "user_id": "user_002",
  "transaction": {
    "amount": 2000.00,
    "recipient_account": "6661234567",
    "timestamp": "2026-04-23T14:00:00+08:00",
    "transaction_type": "duitnow_transfer"
  }
}
```

---

## Reason codes

Every possible value of `reason_codes[].code`:

| Code | Severity | Points | Fires when |
|------|----------|--------|------------|
| `UNUSUAL_AMOUNT`             | high   | 25 | Amount > 5× user's 30-day rolling average |
| `EXCEEDS_HISTORICAL_MAX`     | high   | 25 | Amount > 1.5× user's 90-day historical max |
| `NEW_RECIPIENT_LARGE_AMOUNT` | high   | 25 | Recipient never seen AND amount > RM1000 |
| `DORMANT_REACTIVATION`       | high   | 25 | No activity in 30 days AND amount > RM500 |
| `NEW_RECIPIENT`              | medium | 15 | Recipient never seen AND amount ≤ RM1000 (fires instead of the `_LARGE_AMOUNT` variant) |
| `HIGH_VELOCITY`              | medium | 15 | ≥3 transactions in the last 10 minutes |
| `UNUSUAL_TIME`               | low    |  7 | Transaction hour outside user's top-80% active hours |
| `ROUND_AMOUNT`               | low    |  7 | Amount ∈ { RM500, 1000, 2000, 5000, 10000 } |

---

## Local development

```bash
cd layer3-behavioral-fraud
uv venv .venv --python 3.11
# macOS/Linux:  source .venv/bin/activate
# Windows:      .venv\Scripts\Activate.ps1
uv pip install -e .

# (Re)generate synthetic data — deterministic, SEED=42
python -m scripts.generate_synthetic_data

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8083 --reload
```

---

## Layout

```
app/
  main.py                           FastAPI entry + 4 endpoints + startup hook
  models/
    request.py                      Pydantic request schemas
    response.py                     Pydantic response schemas + Decision/Severity enums
    user.py                         internal User / Transaction dataclasses
  services/
    data_loader.py                  in-memory JSON-backed store
    rules_engine.py                 8 deterministic fraud rules
    ml_model.py                     per-user Isolation Forest (WIP)
    feature_engineering.py          txn → feature vector for ML (WIP)
    risk_scorer.py                  rules + ML → score + Decision + copy
    profile_builder.py              user history → ProfileSummary
data/         users.json, transactions.json (generated)
scripts/      generate_synthetic_data.py
tests/        test_scenarios.py (stub)
```

---

## Personas (shared across all 3 backend services)

| user_id   | Name      | Role                          | Demo scenario                        | Decision    | Risk |
|-----------|-----------|-------------------------------|--------------------------------------|-------------|------|
| user_001  | Aisyah    | Office worker, Bangsar South  | RM4800 new acct @ 23:47 (love-scam)  | `BLOCK`     | 99   |
| user_002  | Ahmad     | Grab driver                   | 5× RM2000 within 10 min (phone theft)| `BLOCK`     | 100  |
| user_003  | Wei       | Student, IOI City             | RM18 QR bubble tea (normal)          | `ALLOW`     | 15   |
| user_003  | Wei       | Student, IOI City             | RM150 new acct @ 03:00 (subtle)      | `NOTIFY`    | 30   |
| user_004  | Mak Timah | Retiree                       | RM8000 new acct @ 20:00 (PDRM scam)  | `BLOCK`     | 99   |

Tests in [`tests/test_scenarios.py`](tests/test_scenarios.py) lock these in — run `pytest` to verify.
