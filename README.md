# ScamBusters — TNG FinHack 2026

> **Pre-transaction scam detection for Malaysian consumers.**
> Paste a bank account, a suspicious link, or a chat export — get a risk verdict before you send the money.

Live: `http://scambuster-alb-399113752.ap-southeast-1.elb.amazonaws.com` (port 80)

---

## The Problem

Malaysia's fraud registries and rule-based blocks use the same thresholds for everyone. A transfer that's normal for a business owner looks like fraud for a retiree — and a subtle scam that only looks suspicious in the context of *one person's* behaviour slips through both.

---

## Solution Overview

ScamBusters runs four independent fraud signals in parallel and combines them into a single risk verdict:

| Layer | Signal | How |
|---|---|---|
| **NFP** | National Fraud Portal | PayNet mule registry — checks the account against filed fraud reports |
| **Semak Mule** | BNM Semak Mule | Bank Negara Malaysia's official mule account database |
| **Link Scan** | URL scraper + LLM | Playwright scrape → multilingual keyword match → LLM classification across 4 dimensions |
| **Behavioral (Layer 3)** | Per-user anomaly detection | Rules engine + per-user Isolation Forest ML model hosted on AWS SageMaker |

The final score is a **noisy-OR combination** of signal probabilities, so a single strong hit (e.g. Semak Mule match) drives the verdict to High Risk on its own, and multiple weak hits compound.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│             Frontend (React 19 + Vite)        │
│        ECS Fargate · nginx:alpine · port 80   │
└──────────────────────┬───────────────────────┘
                       │  HTTP
                       ▼
┌──────────────────────────────────────────────┐
│         Consolidated Backend (FastAPI)        │
│        ECS Fargate · Python 3.12 · port 8000  │
│                                               │
│  /api/v1/nfp/           NFP registry check    │
│  /api/v1/semakmule/     BNM Semak Mule check  │
│  /api/v1/fraud-scan/    URL scrape + LLM      │
│  /api/v1/behavioral/    Behavioral fraud      │
│  /api/health            Health probe          │
└───────┬───────────────────┬──────────────────┘
        │                   │
        ▼                   ▼
┌──────────────┐   ┌──────────────────────────┐
│  LLM API     │   │  AWS SageMaker MME        │
│  (OpenAI-    │   │  Isolation Forest models  │
│  compatible) │   │  one artifact per user    │
└──────────────┘   └──────────┬───────────────┘
                              │
                              ▼
                   ┌──────────────────────────┐
                   │  AWS S3                   │
                   │  data/users.json          │
                   │  data/transactions.json   │
                   │  models/user_XXX.tar.gz   │
                   └──────────────────────────┘
```

Both services deploy to **AWS ECS Fargate** behind an **Application Load Balancer**. GitHub Actions builds, pushes to ECR, and deploys on every push to `main`.

### Multi-Cloud Architecture

![Multi-Cloud Architecture](docs/image/multi-cloud-architecture.png)

---

## Layer 3 — Behavioral Fraud Detection

*Owned by [@Ilham Firdaus](https://github.com/IlhamFirdaus)*

The behavioral service is what makes ScamBusters different from static registry checks. Instead of applying the same RM5,000 threshold to every user, it learns each person's spending pattern and flags deviations from *their own* baseline.

### How it works

**Step 1 — Rules engine (8 rule checks)**

| Rule | Severity | Trigger |
|---|---|---|
| `UNUSUAL_AMOUNT` | HIGH | Amount > 5× user's 30-day rolling average |
| `EXCEEDS_HISTORICAL_MAX` | HIGH | Amount > 1.5× user's all-time maximum |
| `NEW_RECIPIENT_LARGE_AMOUNT` | HIGH | First-time recipient AND amount > RM1,000 |
| `DORMANT_REACTIVATION` | HIGH | No activity in 30 days, now a large transfer |
| `HIGH_VELOCITY` | MEDIUM | >3 transactions in 10 minutes |
| `NEW_RECIPIENT` | MEDIUM | Recipient account never seen before |
| `UNUSUAL_TIME` | LOW | Hour outside user's top-80% active hours |
| `ROUND_AMOUNT` | LOW | Exact RM500/1000/2000/5000/10000 |

**Step 2 — ML model (per-user Isolation Forest)**

Each user has their own Isolation Forest trained on 12 features extracted from their transaction history:

`amount_z_score`, `log_amount`, `hour_sin`, `hour_cos`, `day_of_week`, `is_weekend`, `is_late_night`, `is_new_recipient`, `days_since_last_txn`, `velocity_10min`, `amount_pct_of_max`, `amount_pct_of_avg`

Model artifacts (`.tar.gz`) are stored in S3 and loaded lazily by a **SageMaker Multi-Model Endpoint** — one endpoint serves every user, models are loaded on first call and cached in the endpoint's memory.

**Step 3 — Score fusion**

```
rule_based_score  = sum(severity_points)   # HIGH=25 / MEDIUM=15 / LOW=7
ml_contribution   = scale(anomaly_score)   # maps [-0.5, 0] → [40, 0] pts
final_risk_score  = min(100, rule_based_score + ml_contribution)
```

Rules carry up to 60 points; ML contributes up to 40 points.

**Decision thresholds**

| Score | Decision | Action |
|---|---|---|
| 0 – 39 | `ALLOW` | Silent pass |
| 40 – 69 | `NOTIFY` | Post-transaction notice |
| 70 – 100 | `CHALLENGE` | Re-authentication modal (transaction still goes through on success) |

### API endpoints

```
POST /api/v1/behavioral/check-transaction     score a candidate transaction
GET  /api/v1/behavioral/user-profile/{id}     view a user's spending profile
POST /api/v1/behavioral/simulate-transaction  add a transaction and rescore
```

---

## Demo Personas (Layer 3)

Pre-seeded in the live deployment. Use these `user_id` values to hit the behavioral API or trigger demo flows in the frontend.

| `user_id` | Name | Scenario | Decision | Score |
|---|---|---|---|---|
| `user_001` | Aisyah | RM4,800 to new account at 23:47 — love-scam pattern | `CHALLENGE` | ~94 |
| `user_002` | Ahmad | 5× RM2,000 within 10 min — phone-theft velocity | `CHALLENGE` | ~100 |
| `user_003` | Wei | RM18 QR bubble-tea — within normal range | `ALLOW` | ~15 |
| `user_004` | Mak Timah | RM8,000 to new account at 20:00 — PDRM impersonation | `CHALLENGE` | ~99 |

---

## Repo Layout

```
.
├── backend/                       # Consolidated FastAPI (port 8000)
│   ├── api/v1/
│   │   ├── behavioral.py          # Layer 3 behavioral fraud endpoints
│   │   ├── fraud_scan.py          # URL scraper + LLM scan endpoints
│   │   ├── nfp.py                 # NFP registry endpoints
│   │   └── semakmule.py           # BNM Semak Mule endpoints
│   ├── services/
│   │   ├── behavioral/            # rules_engine, ml_model, risk_scorer,
│   │   │                          #   feature_engineering, sagemaker_client
│   │   └── fraud_scan/            # scraper, classifier, keywords, prompts
│   ├── models/                    # Pydantic request/response schemas
│   ├── db/                        # SQLAlchemy schema + seed (mule data)
│   └── main.py                    # FastAPI app + lifespan
│
├── frontend/                      # React 19 + Vite + Tailwind (port 5173 dev)
│   └── src/
│       ├── pages/                 # Landing, Check, Checking, Report,
│       │                          #   Dashboard, About, DemoTransfer, DemoLinks
│       ├── components/            # TopNav, SourceMarquee, FloatingReportCard…
│       └── lib/
│           ├── api.ts             # Typed clients for all backend services
│           ├── mockReport.ts      # Report builder + demo fixtures
│           └── dashboardStore.ts  # LocalStorage-backed analyst dashboard
│
├── ci/
│   ├── docker/
│   │   ├── backend/Dockerfile     # python:3.12-slim + Playwright
│   │   └── frontend/
│   │       ├── Dockerfile         # node:22-alpine build → nginx:alpine serve
│   │       └── nginx.conf         # SPA fallback (try_files → index.html)
│   └── task-definitions/          # ECS task definitions (backend + frontend)
│
├── .github/workflows/deploy.yml   # Build → ECR push → ECS deploy (on push to main)
│
└── archive/                       # Original per-service folders (reference only)
    ├── layer3-behavioral-fraud/
    ├── mule_check_api/
    └── fraud_detect_api/
```

---

## Running Locally

**Prerequisites:** Python 3.11+, Node 20+

```bash
# 1. Install Python deps (from repo root)
pip install -e backend/

# 2. Install Playwright browser
playwright install chromium --with-deps

# 3. Seed the mule database (one-time)
python -m backend.db.seed

# 4. Copy env and fill in keys
cp .env.example .env

# 5. Start the backend
uvicorn backend.main:app --port 8000 --reload

# 6. Start the frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open <http://localhost:5173>. The frontend auto-proxies to `http://localhost:8000`.

---

## Environment Variables

```bash
# ── LLM classifier (fraud_scan) ───────────────────────────────────────────────
LLM_API_KEY=           # OpenAI-compatible API key
LLM_BASE_URL=          # Base URL of the LLM API
LLM_MODEL=ilmu-mini-v3
LLM_REASONING_EFFORT=  # optional: "low" | "high"

# ── Layer 3 behavioral fraud (AWS) ────────────────────────────────────────────
AWS_REGION=ap-southeast-1
S3_DATA_BUCKET=tngdfinhack-ml-model-store        # users.json + transactions.json
S3_MODEL_BUCKET=tngdfinhack-ml-model-store       # Isolation Forest .tar.gz artifacts
SAGEMAKER_ENDPOINT_NAME=layer3-isolation-forest-mme
SAGEMAKER_ROLE_ARN=arn:aws:iam::<account>:role/<role>

# ── Frontend (Vite build arg — optional, localhost defaults are baked in) ─────
VITE_API_URL=http://localhost:8000
```

---

## CI / CD

Every push to `main` triggers the GitHub Actions pipeline:

1. **Path filter** — only builds the service(s) whose files changed
2. **Docker build** — multi-stage build, pushed to Amazon ECR with `latest` + `<sha>` tags
3. **ECS deploy** — renders task definition with new image SHA, deploys to Fargate, waits for stability

Backend image: `python:3.12-slim` + Playwright Chromium  
Frontend image: `node:22-alpine` (build) → `nginx:alpine` (serve)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Python 3.12, Pydantic v2, SQLAlchemy |
| Behavioral ML | scikit-learn Isolation Forest, NumPy, joblib |
| ML Serving | AWS SageMaker Multi-Model Endpoint |
| Data Store | AWS S3 |
| Scraping | Playwright (Chromium), Trafilatura, BeautifulSoup4 |
| LLM | OpenAI-compatible API (ilmu-mini-v3) |
| Infrastructure | AWS ECS Fargate, ECR, Application Load Balancer |
| CI / CD | GitHub Actions |

---

## Disclaimer

Hackathon prototype for TNG FinHack 2026. Not affiliated with Bank Negara Malaysia, PDRM, PayNet, or Touch 'n Go. Mock NFP and BNM Semak Mule responses are wire-format compatible with the real services but contain no real customer data.
