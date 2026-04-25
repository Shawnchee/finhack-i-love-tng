from __future__ import annotations

import logging

from playwright.async_api import Browser

from backend.models.fraud_scan import ScanResponse
from backend.services.fraud_scan.classifier import FraudDetector
from backend.services.fraud_scan.scraper import scrape

logger = logging.getLogger(__name__)


class FraudScanService:
    def __init__(self, browser: Browser, detector: FraudDetector) -> None:
        self._browser = browser
        self._detector = detector

    async def scan(self, url: str) -> ScanResponse:
        scraped = await scrape(url, self._browser)

        if not scraped.body:
            raise ValueError("No extractable text content found at this URL.")

        classification = await self._detector.classify(
            scraped.body, scraped.platform, url
        )
        if classification is None:
            raise RuntimeError("LLM classification returned no result.")

        return ScanResponse(
            post_id=scraped.post_id,
            platform=scraped.platform,
            url=url,
            title=scraped.title,
            body=scraped.body,
            keywords_matched=scraped.keywords_matched,
            regulatory=classification.regulatory,
            localisation=classification.localisation,
            scam_type=classification.scam_type,
            scam=classification.scam,
            verdict=classification.verdict,
            evidence_summary=classification.evidence_summary,
        )
