# Layer 3 — Behavioral Fraud Detection

TNG FinHack 2026. Per-user behavioral anomaly detection.

Given a candidate transaction, returns a risk score (0-100), a decision (`ALLOW | NOTIFY | CHALLENGE | BLOCK`), and explainable reason codes. Hybrid pipeline: deterministic rules + per-user Isolation Forest.

> One of three backend services in the [Semak](../README.md) project. Runs alongside [`mule_check_api`](../mule_check_api/) (NFP + SemakMule registry checks) and [`fraud_detect_api`](../fraud_detect_api/) (URL scraping + scam-keyword matching). The frontend at [`/check`](../frontend/src/pages/Check.tsx) calls this endpoint via the "Add transaction details" disclosure when a bank account is provided.

---

## Architecture

```
Local machine (one-time, offline)
  scripts/train_and_export.py
  └─ fits one IsolationForest per user → packages as .tar.gz → uploads to S3

                        ▼

AWS S3  (tngdfinhack-ml-model-store)
  data/users.json + data/transactions.json   ← behavioral history
  models/user_001.tar.gz, user_002.tar.gz …  ← trained model artifacts

                        ▼

AWS SageMaker MME  (layer3-isolation-forest-mme)
  Custom sklearn Docker container (scripts/Dockerfile.inference)
  Lazy-loads per-user model from S3 on first request.
  One endpoint serves all users — no redeployment to add a new user.

                        ▲  boto3 invoke_endpoint()

FastAPI service  (port 8083, runs on EC2/ECS)
  Pulls user + transaction history from S3 at startup.
  Runs rules engine in-process, delegates ML scoring to SageMaker.
```

---

## How scoring works

**Rules and ML both run on every transaction.** Their scores add:

```
final_risk_score = min(100, rule_points + ml_points)
```

| Layer | Contributes | Catches |
|---|---|---|
| Rules | 0–100 | Obvious, threshold-based fraud (amount spikes, new recipient, velocity, dormancy) |
| ML (Isolation Forest) | 0–40 | Subtle combinations — no single rule fires, but the joint pattern is unusual for *this* user |

Rule severity points: **high = 25, medium = 15, low = 7.** ML is capped at 40 so it can tip a borderline case into `NOTIFY` but cannot reach `CHALLENGE`/`BLOCK` without rules agreeing — a safety valve against model misbehaviour.

Baseline stats (avg, max, seen-recipients, typical hours) exclude transactions from the **last hour** so rapid-fire fraud clusters don't pollute the user's normal profile.

Models are trained offline via `scripts/train_and_export.py` on each user's transaction history (min 20 txns). Features: amount z-score, amount ratio, hour, day-of-week, is-weekend, days-since-last, recipient-is-new, tx-count last 1h/24h, amount last 24h, tx-type (12 dims).

### Decision tiers

| Score | Decision | Frontend action |
|---|---|---|
| 0–29 | `ALLOW` | Silent pass |
| 30–59 | `NOTIFY` | Post-transaction banner |
| 60–84 | `CHALLENGE` | Modal — require re-auth (PIN / face) |
| 85–100 | `BLOCK` | Hard block. Contact support. |

---

## API

Base URL: `http://localhost:8083` · Swagger: `/docs` · CORS: open (`*`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/check_transaction` | Score a transaction |
| `GET` | `/api/user_profile/{user_id}` | Behavioral baseline summary |
| `POST` | `/api/simulate_transaction` | Demo — inject a tx into in-memory history |

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
- `timestamp` ISO 8601 with timezone (`+08:00` for MYT)

**Response**
```ts
{
  decision: "ALLOW" | "NOTIFY" | "CHALLENGE" | "BLOCK";
  risk_score: number;                   // 0-100
  reason_codes: {
    code: string;
    severity: "low" | "medium" | "high";
    message: string;                    // ready to render
    details: Record<string, any>;
  }[];
  ml_anomaly_score: number;             // raw IF score, more negative = more anomalous
  user_friendly_warning: string;
  recommended_action: string;
}
```

### `GET /api/user_profile/{user_id}`

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

Appends a transaction to the user's in-memory history for the session (not persisted back to S3).

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

| Code | Severity | Points | Fires when |
|---|---|---|---|
| `UNUSUAL_AMOUNT` | high | 25 | Amount > 5× user's 30-day rolling average |
| `EXCEEDS_HISTORICAL_MAX` | high | 25 | Amount > 1.5× user's all-time max |
| `NEW_RECIPIENT_LARGE_AMOUNT` | high | 25 | First-time recipient AND amount > RM1000 |
| `DORMANT_REACTIVATION` | high | 25 | No activity in 30 days AND amount > RM500 |
| `NEW_RECIPIENT` | medium | 15 | First-time recipient AND amount ≤ RM1000 |
| `HIGH_VELOCITY` | medium | 15 | ≥3 transactions in the last 10 minutes |
| `UNUSUAL_TIME` | low | 7 | Hour outside user's top-80% active hours |
| `ROUND_AMOUNT` | low | 7 | Amount ∈ { RM500, 1000, 2000, 5000, 10000 } |

---

## Setup

### Environment variables

Copy `.env.example` to `.env` and fill in values. On AWS, inject these via ECS task definition — no file needed.

| Variable | Used by | Purpose |
|---|---|---|
| `AWS_REGION` | all | e.g. `ap-southeast-1` |
| `S3_DATA_BUCKET` | FastAPI, training script | Bucket with `data/users.json` + `data/transactions.json` |
| `S3_MODEL_BUCKET` | training + deploy scripts | Bucket where model `.tar.gz` artifacts are uploaded |
| `SAGEMAKER_ENDPOINT_NAME` | FastAPI | MME endpoint to invoke |
| `SAGEMAKER_ROLE_ARN` | deploy script only | IAM role for SageMaker to access S3 |

### Deploy the inference container

```bash
# 1. Build and push custom sklearn container to ECR
.\scripts\build_push_ecr.ps1

# 2. Train all per-user models and upload artifacts to S3
python -m scripts.train_and_export

# 3. Create the SageMaker Multi-Model Endpoint (one-time)
python -m scripts.deploy_endpoint
```

### Run the API

```bash
# Docker
docker build -t layer3 .
docker run -p 8083:8083 --env-file .env layer3

# Local (requires AWS credentials + S3_DATA_BUCKET set)
uv pip install -e ".[dev]"
uvicorn app.main:app --port 8083 --reload
```

---

## File layout

```
app/
  main.py                   FastAPI entry point + 4 endpoints
  models/
    request.py              Pydantic request schemas
    response.py             Pydantic response schemas + enums
    user.py                 User / Transaction dataclasses
  services/
    data_loader.py          Pulls users + transactions from S3 at startup
    rules_engine.py         8 deterministic fraud rules
    feature_engineering.py  Transaction → 12-dim feature vector
    ml_model.py             Delegates scoring to SageMaker client
    sagemaker_client.py     boto3 wrapper — invokes the MME endpoint
    risk_scorer.py          Combines rule points + ML score → Decision
    profile_builder.py      User history → ProfileSummary

scripts/
  train_and_export.py       Train IsolationForests locally → upload to S3
  deploy_endpoint.py        Create SageMaker MME endpoint (run once)
  build_push_ecr.ps1        Build inference Docker image → push to ECR
  Dockerfile.inference      Custom sklearn container for SageMaker MME
  serve.py                  Flask MME server running inside the container
  inference.py              model_fn / predict_fn — packaged inside each .tar.gz
  generate_synthetic_data.py  Regenerate demo data (SEED=42, deterministic)

tests/
  test_scenarios.py         Scenario tests for all 4 personas
```

---

## Personas (shared across all 3 backend services)

| user_id | Name | Scenario | Decision | Risk |
|---|---|---|---|---|
| user_001 | Aisyah | RM4800 new account @ 23:47 (love scam) | `BLOCK` | 99 |
| user_002 | Ahmad | 5× RM2000 within 10 min (phone theft) | `BLOCK` | 100 |
| user_003 | Wei | RM18 QR bubble tea (normal) | `ALLOW` | 15 |
| user_003 | Wei | RM150 new account @ 03:00 (subtle) | `NOTIFY` | 30 |
| user_004 | Mak Timah | RM8000 new account @ 20:00 (PDRM scam) | `BLOCK` | 99 |
