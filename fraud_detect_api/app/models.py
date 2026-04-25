"""Request / response Pydantic models for the fraud detection API."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, field_validator


class Verdict(str, Enum):
    SCAM = "SCAM"
    NOT_SCAM = "NOT_SCAM"


class ScanRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def must_be_http(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class RegulatoryDetail(BaseModel):
    is_capital_market: bool
    product_types: list[str]
    intent: str
    reasoning: str


class LocalisationDetail(BaseModel):
    targets_malaysians: bool
    localisation_cues: list[str]
    languages_detected: list[str]
    reasoning: str


class ScamDetail(BaseModel):
    is_scam: bool
    confidence: float
    indicators_found: list[str]
    indicator_evidence: dict[str, str]
    reasoning: str


class ScanResponse(BaseModel):
    """Matches the ScamClassification shape produced by sec-scraper."""

    # Source metadata
    post_id: str
    platform: str
    url: str
    title: str
    body: str
    keywords_matched: list[str]

    # Classification dimensions
    regulatory: RegulatoryDetail | None = None
    localisation: LocalisationDetail | None = None
    scam: ScamDetail | None = None

    # Final verdict
    verdict: Verdict | None = None
    evidence_summary: str | None = None

