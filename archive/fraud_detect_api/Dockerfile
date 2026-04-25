# ── Fraud Detection API ────────────────────────────────────────────────────
# FastAPI + Playwright (Chromium) image.
# Listens on port 8082.
FROM python:3.11-slim

# System dependencies required by Playwright / Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv

# Copy dependency manifest first — maximises layer cache hits
COPY pyproject.toml ./

# Install all project dependencies (no dev extras)
RUN uv pip install --system . --no-cache

# Install Playwright's Chromium browser + system deps
RUN playwright install chromium && playwright install-deps chromium

# Fetch camoufox (patched Firefox) for Cloudflare bypass — used by Cari scraper
RUN python -m camoufox fetch

# Copy application source
COPY app/ ./app/

RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8082

# Healthcheck — used by ECS/ALB target group
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8082/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"]
