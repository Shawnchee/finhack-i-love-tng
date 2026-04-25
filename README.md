# Semak — TNG FinHack 2026

A consumer-facing pre-transaction scam check for Malaysians. Paste a bank account, a link, or a chat export — get a verdict (`LOW` / `MEDIUM` / `HIGH RISK`) before you send the money.

UX in one line: **a calm expert friend replying fast — one input, honest uncertainty, zero dashboard.**

---

## Architecture

Three independent FastAPI services + one React frontend. Each service is owned by a different layer of the scam-detection pipeline and can be developed in isolation.

```
                       ┌─────────────────────────┐
                       │  frontend (Vite + React)│
                       │  http://localhost:5173  │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐   ┌────────────────────────┐   ┌──────────────────┐
│ mule_check_api   │   │ layer3-behavioral-     │   │ fraud_detect_api │
│   :8000          │   │ fraud  :8083           │   │   :8081          │
│                  │   │                        │   │                  │
│ NFP + SemakMule  │   │ per-user transaction   │   │ URL scrape +     │
│ registry mocks   │   │ risk scoring (rules    │   │ scam-keyword     │
│                  │   │ + Isolation Forest)    │   │ matcher          │
└──────────────────┘   └────────────────────────┘   └──────────────────┘
```

| Service | Port | Stack | Purpose |
|---|---|---|---|
| [`mule_check_api`](mule_check_api/) | 8000 | FastAPI + SQLAlchemy | Mocks PayNet **NFP** and **SemakMule** mule-account registries — wire-format compatible with the production APIs. |
| [`layer3-behavioral-fraud`](layer3-behavioral-fraud/) | 8083 | FastAPI + scikit-learn | Per-user behavioral anomaly detection. Scores a candidate transaction `0–100` and returns `ALLOW / NOTIFY / CHALLENGE / BLOCK` with explainable reason codes. |
| [`fraud_detect_api`](fraud_detect_api/) | 8081 | FastAPI + Playwright + OpenAI-compatible LLM | Scrapes a URL (Reddit, Lowyat, Cari, Mudah, generic sites), matches against a multilingual scam-keyword corpus (EN / BM / Manglish / Chinese), then runs LLM classification across four dimensions: regulatory (SC Malaysia capital-market scope), localisation (Malaysian targeting), scam type, and scam indicators. Returns a final `SCAM` / `NOT_SCAM` verdict with an evidence summary. |
| [`frontend`](frontend/) | 5173 | React 19 + Vite + Tailwind | Single-page app: `/`, `/check`, `/checking`, `/report/:id`, `/transaction-check`, `/about`. |

---

## Quickstart

**Prereqs:** macOS or Linux, Python 3.11+, Node 20+, [Homebrew](https://brew.sh/) (for Overmind).

```bash
# 1. Install everything (overmind + python deps + Playwright Chromium + npm deps)
make install

# 2. Seed mule_check_api's SQLite DB with known mules (one-time, idempotent)
.venv/bin/python -m mule_check_api.dummy_data.seed

# 3. Run all 4 processes in one terminal — Ctrl+C kills them all cleanly
overmind start
```

That's it. Open <http://localhost:5173>.

If a port hangs after a crash:

```bash
make kill   # frees 8000 / 8081 / 8083 / 5173
```

### What `overmind start` does

[Overmind](https://github.com/DarthSim/overmind) is a tmux-backed process manager. It reads [`Procfile`](Procfile) and runs every process in its own tmux pane:

```
mule:     .venv/bin/python -m uvicorn mule_check_api.main:app --port 8000 --reload
layer3:   cd layer3-behavioral-fraud && ../.venv/bin/python -m uvicorn app.main:app --port 8083 --reload
scrape:   cd fraud_detect_api && ../.venv/bin/python -m uvicorn app.main:app --port 8081 --reload
frontend: cd frontend && npm run dev
```

Each backend invokes Python via the project-root `.venv` so PATH and shell-aliased `python3` confusion stays out of the picture.

Attach to a single process to debug it:

```bash
overmind connect layer3       # detach with Ctrl+b d
```

### Running services individually

Each service is independent — you can run any subset.

```bash
# Activate the project venv first (one-off per shell)
source .venv/bin/activate

# mule_check_api — runs from project root so the package is importable
uvicorn mule_check_api.main:app --port 8000 --reload

# layer3-behavioral-fraud
cd layer3-behavioral-fraud && uvicorn app.main:app --port 8083 --reload

# fraud_detect_api
cd fraud_detect_api && uvicorn app.main:app --port 8081 --reload

# frontend (no venv needed)
cd frontend && npm run dev
```

---

## Environment

See [`.env.example`](.env.example) for the full list. Two services have configurable env:

### `fraud_detect_api` — LLM classifier

The `/api/scan` endpoint needs an OpenAI-compatible LLM endpoint to produce the `verdict` / `regulatory` / `localisation` / `scam` classification. Without these env vars, scraping still works but the classification fields come back `null`.

```bash
LLM_API_KEY=...
LLM_BASE_URL=...                  # OpenAI-compatible base URL
LLM_MODEL=ilmu-mini-v3            # default
LLM_REASONING_EFFORT=              # optional: "low" or "high"
```

Drop these into a `.env` file at the repo root (loaded via `python-dotenv` from `fraud_detect_api/app/main.py`).

### Frontend Vite env

Localhost defaults are baked in — no `.env` needed for local dev.

```bash
VITE_MULE_API_URL=http://localhost:8000     # mule_check_api
VITE_LAYER3_API_URL=http://localhost:8083   # layer3-behavioral-fraud
VITE_SCRAPE_API_URL=http://localhost:8081   # fraud_detect_api
```

---

## Repo layout

```
.
├── Makefile                       # install / kill helpers
├── Procfile                       # overmind process definitions
├── PRD.md                         # product requirements
├── PAGES.md                       # frontend page-level design spec
│
├── mule_check_api/                # NFP + SemakMule mock (port 8000)
│   ├── HANDBOOK.md                # API reference + seed data
│   ├── api/v1/                    # nfp.py, semakmule.py
│   ├── services/                  # nfp_service.py, semakmule_service.py
│   ├── models/                    # pydantic request/response
│   ├── db/                        # SQLAlchemy schema + session
│   ├── core/                      # config, logging
│   ├── dummy_data/                # seed.py — `python -m mule_check_api.dummy_data.seed`
│   └── main.py
│
├── layer3-behavioral-fraud/       # transaction risk scorer (port 8083)
│   ├── README.md                  # full API + scoring details
│   ├── app/
│   │   ├── main.py                # 4 endpoints + startup hook
│   │   ├── services/              # rules_engine, ml_model, risk_scorer, ...
│   │   └── models/                # pydantic request/response
│   ├── data/                      # users.json, transactions.json (generated)
│   ├── scripts/generate_synthetic_data.py
│   └── tests/test_scenarios.py
│
├── fraud_detect_api/              # URL scraper + keyword matcher (port 8081)
│   └── app/
│       ├── main.py                # FastAPI entry + /api/scrape
│       ├── scraper.py             # site-specific routing
│       ├── cari_scraper.py
│       └── keywords.py
│
└── frontend/                      # React 19 + Vite (port 5173)
    └── src/
        ├── pages/                 # Landing, Check, Checking, Report, About, TransactionCheck
        ├── components/            # BlurText, CountUp, Magnet, TiltedCard, ...
        └── lib/
            ├── api.ts             # typed clients for all 3 backends
            ├── detect.ts          # input-type sniffing
            └── mockReport.ts      # demo fixtures
```

---

## Demo personas (Layer 3)

| `user_id` | Name | Demo scenario | Decision | Risk |
|---|---|---|---|---|
| `user_001` | Aisyah | RM4800 to new account @ 23:47 (love-scam) | `BLOCK` | 99 |
| `user_002` | Ahmad | 5× RM2000 within 10 min (phone theft) | `BLOCK` | 100 |
| `user_003` | Wei | RM18 QR bubble tea (normal) | `ALLOW` | 15 |
| `user_003` | Wei | RM150 to new account @ 03:00 (subtle) | `NOTIFY` | 30 |
| `user_004` | Mak Timah | RM8000 to new account @ 20:00 (PDRM scam) | `BLOCK` | 99 |

Locked in by [`layer3-behavioral-fraud/tests/test_scenarios.py`](layer3-behavioral-fraud/tests/test_scenarios.py). Run `pytest` from that directory to verify.

---

## Further reading

- [`PRD.md`](PRD.md) — product requirements, scoring rationale, source weighting.
- [`PAGES.md`](PAGES.md) — page-by-page design + interaction spec for the frontend.
- [`mule_check_api/HANDBOOK.md`](mule_check_api/HANDBOOK.md) — full NFP + SemakMule API reference with seed records.
- [`layer3-behavioral-fraud/README.md`](layer3-behavioral-fraud/README.md) — rules, ML pipeline, reason codes, response shapes.

---

## Disclaimer

Hackathon prototype for TNG FinHack 2026. Not affiliated with Bank Negara Malaysia, PDRM, PayNet, or Touch 'n Go. The mock NFP / SemakMule responses are wire-format compatible with the real services but contain no real customer data.
