# Fraud Detection API

FastAPI service that accepts any URL (blog, website, social media), scrapes its content, and classifies it for financial fraud / capital-market scam patterns using an LLM.

Built on top of `web-scraper` (Playwright + trafilatura) and `sec-scraper` (SC Malaysia scam classifier + keyword sets).

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/scan` | Scrape a URL and return fraud classification |
| `GET` | `/docs` | Swagger UI |

### POST /api/scan

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{
  "post_id": "a1b2c3d4e5f6",
  "platform": "website",
  "url": "https://example.com",
  "title": "Page title",
  "body": "Extracted text...",
  "keywords_matched": ["investment", "guaranteed profit"],
  "regulatory": {
    "is_capital_market": true,
    "product_types": ["crypto_investment"],
    "intent": "investment_promotion",
    "reasoning": "..."
  },
  "localisation": {
    "targets_malaysians": true,
    "localisation_cues": ["RM currency used"],
    "languages_detected": ["English", "Manglish"],
    "reasoning": "..."
  },
  "scam": {
    "is_scam": true,
    "confidence": 0.92,
    "indicators_found": ["guaranteed_or_unrealistic_returns"],
    "indicator_evidence": { "guaranteed_or_unrealistic_returns": "100% profit guaranteed" },
    "reasoning": "..."
  },
  "verdict": "SCAM",
  "evidence_summary": "..."
}
```

---

## Local development

### Prerequisites
- Python 3.11+
- [`uv`](https://github.com/astral-sh/uv)

### Setup

```bash
cd fraud_detect_api

# Create virtualenv and install dependencies
uv venv .venv --python 3.11
source .venv/bin/activate
uv pip install -e "."

# Install Playwright's Chromium browser
playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env — set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
```

### Run

```bash
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

Visit `http://localhost:8082/docs` for the interactive Swagger UI.

---

## Docker

### Build

```bash
docker build -t fraud-detect-api .
```

### Run locally

```bash
docker run -p 8082:8082 \
  -e LLM_API_KEY=your-key \
  -e LLM_BASE_URL=https://your-endpoint/v1 \
  -e LLM_MODEL=ilmu-mini-v3 \
  fraud-detect-api
```

---

## Deploy to AWS ECR

### One-time setup

```bash
# Set your values
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=123456789012
ECR_REPO=fraud-detect-api

# Create the ECR repository (run once)
aws ecr create-repository \
  --repository-name $ECR_REPO \
  --region $AWS_REGION
```

### Build and push

```bash
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=123456789012
ECR_REPO=fraud-detect-api
ECR_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO

# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for linux/amd64 (required for ECS Fargate)
docker buildx build --platform linux/amd64 -t $ECR_URI:latest --push .
```

### Run from ECR (local test)

```bash
docker run -p 8082:8082 \
  -e LLM_API_KEY=your-key \
  -e LLM_BASE_URL=https://your-endpoint/v1 \
  -e LLM_MODEL=ilmu-mini-v3 \
  $ECR_URI:latest
```

### ECS Fargate task (minimal)

In your ECS task definition, set these container environment variables:

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | API key for the LLM endpoint |
| `LLM_BASE_URL` | Base URL of the OpenAI-compatible endpoint |
| `LLM_MODEL` | Model name (e.g. `ilmu-mini-v3`) |
| `LLM_REASONING_EFFORT` | Optional: `low` or `high` (leave blank if unsupported) |

Container port: **8082**
Health check path: **`/api/health`**

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_KEY` | Yes | — | API key for the LLM endpoint |
| `LLM_BASE_URL` | Yes | — | Base URL (e.g. `https://your-endpoint/v1`) |
| `LLM_MODEL` | No | `ilmu-mini-v3` | Model name |
| `LLM_REASONING_EFFORT` | No | _(off)_ | `low` or `high` — enables extended reasoning if the model supports it |
| `REDDIT_CLIENT_ID` | Yes (Reddit) | — | OAuth client ID from reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | Yes (Reddit) | — | OAuth client secret |
