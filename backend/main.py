import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright

from backend.api.v1 import behavioral, fraud_scan, nfp, semakmule
from backend.core.config import config
from backend.core.logging import setup_logging
from backend.db.schema import Base, engine
from backend.services.behavioral.service import BehavioralService
from backend.services.fraud_scan.service import FraudScanService
from backend.services.fraud_scan.classifier import FraudDetector

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mule check DB
    Base.metadata.create_all(bind=engine)

    # Fraud scan — Playwright browser + LLM detector
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    app.state.fraud_scan_service = FraudScanService(browser, FraudDetector())
    logger.info("Fraud scan service ready.")

    # Behavioral — load user data from S3
    behavioral_svc = BehavioralService()
    try:
        behavioral_svc.load()
    except RuntimeError as exc:
        logger.warning("Behavioral service skipped: %s", exc)
    app.state.behavioral_service = behavioral_svc

    yield

    await browser.close()
    await pw.stop()
    logger.info("Shutdown complete.")


app = FastAPI(title=config.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nfp.router, prefix="/api/v1")
app.include_router(semakmule.router, prefix="/api/v1")
app.include_router(fraud_scan.router, prefix="/api/v1")
app.include_router(behavioral.router, prefix="/api/v1")


@app.get("/api/health")
def health():
    return {"status": "ok"}
