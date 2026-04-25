# ── Layer 3 — Behavioral Fraud Detection ──────────────────────────────────
# FastAPI + per-user Isolation Forest (sklearn). Listens on port 8083.
FROM python:3.11-slim

# Only system dep we need is curl (for the healthcheck). No Playwright here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# uv for fast dependency resolution — same toolchain as local dev
RUN pip install --no-cache-dir uv

# Copy dependency manifest first so the install layer caches across code changes
COPY pyproject.toml ./

RUN uv pip install --system -e "." --no-cache

# Application source + synthetic dataset (IF models are trained from this on startup)
COPY app/ ./app/
COPY data/ ./data/

EXPOSE 8083

# start-period covers JSON load + 4 IsolationForest fits (~1s on small data)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8083/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
