# ── Layer 3 — Behavioral Fraud Detection ──────────────────────────────────
# FastAPI + SageMaker Multi-Model Endpoint. Listens on port 8083.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# uv for fast dependency resolution — same toolchain as local dev
RUN pip install --no-cache-dir uv

# Copy dependency manifest first so the install layer caches across code changes
COPY pyproject.toml ./

RUN uv pip install --system -e "." --no-cache

COPY app/ ./app/

# ── AWS env vars ──────────────────────────────────────────────────────────────
# Inject real values at runtime (ECS task definition / docker run -e).
# DO NOT hardcode credentials here.
ENV AWS_REGION=ap-southeast-1
ENV SAGEMAKER_ENDPOINT_NAME=layer3-isolation-forest-mme
# S3 bucket where data/users.json and data/transactions.json are stored.
ENV S3_DATA_BUCKET=

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8083/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083"]
