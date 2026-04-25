"""FastAPI application — URL fraud detection."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright

from app.classifier import FraudDetector
from app.models import ScanRequest, ScanResponse
from app.scraper import scrape

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    app.state.browser = browser
    app.state.playwright = pw
    app.state.detector = FraudDetector()
    logger.info("Browser and fraud detector ready.")
    yield
    await browser.close()
    await pw.stop()
    logger.info("Browser closed.")


app = FastAPI(
    title="Fraud Detection API",
    description="Scrape any URL and classify it for financial fraud / scam patterns.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/scan", response_model=ScanResponse)
async def scan(body: ScanRequest) -> ScanResponse:
    url = body.url

    # Step 1: scrape
    try:
        scraped = await scrape(url, app.state.browser)
    except Exception as exc:
        logger.error("Scraping failed for %s: %s", url, exc)
        raise HTTPException(status_code=422, detail=f"Failed to scrape URL: {exc}")

    if not scraped.body:
        raise HTTPException(status_code=422, detail="No extractable text content found at this URL.")

    # Step 2: classify
    classification = None
    try:
        classification = await app.state.detector.classify(
            scraped.body, scraped.platform, url
        )
    except Exception as exc:
        logger.error("Classification failed for %s: %s", url, exc)
        raise HTTPException(status_code=500, detail=f"Classification failed: {exc}")

    if classification is None:
        raise HTTPException(status_code=500, detail="LLM classification returned no result.")

    response = ScanResponse(
        post_id=scraped.post_id,
        platform=scraped.platform,
        url=url,
        title=scraped.title,
        body=scraped.body,
        keywords_matched=scraped.keywords_matched,
    )

    if classification is not None:
        response.regulatory = classification.regulatory
        response.localisation = classification.localisation
        response.scam = classification.scam
        response.verdict = classification.verdict
        response.evidence_summary = classification.evidence_summary

    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8082, reload=True)
