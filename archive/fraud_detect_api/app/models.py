"""Request / response Pydantic models for the fraud detection API."""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, field_validator


class Verdict(str, Enum):
    SCAM = "SCAM"
    NOT_SCAM = "NOT_SCAM"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ScamCategory(str, Enum):
    CAPITAL_MARKET = "CAPITAL_MARKET"
    ROMANCE = "ROMANCE"
    EMPLOYMENT = "EMPLOYMENT"
    DELIVERY = "DELIVERY"
    IMPERSONATION = "IMPERSONATION"
    BANKING = "BANKING"
    GENERAL = "GENERAL"
    UNKNOWN = "UNKNOWN"


# Telegram username rules: 5–32 chars, must start with a letter, then
# alphanumeric + underscore. Reference: https://core.telegram.org/method/account.checkUsername
_TELEGRAM_USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{4,31}$")


def _normalise_to_url(raw: str) -> str:
    """
    Coerce a user-supplied identifier into a scrapeable URL.

    Accepted forms (in priority order):
      • Full URL with scheme           — returned as-is.
      • t.me/... or telegram.me/...    — prepended with https://
      • Leading "@username"            — converted to https://t.me/{username}
      • Bare valid Telegram username   — converted to https://t.me/{username}
      • Anything else                  — rejected (raises ValueError).

    The downstream scraper still does its own routing, so this only needs
    to produce something that looks like a URL.
    """
    s = raw.strip()
    if not s:
        raise ValueError("URL is empty.")

    # 1. Already a URL.
    if s.startswith(("http://", "https://")):
        return s

    # 2. Schemeless t.me / telegram.me — add https://.
    lower = s.lower()
    for host in ("t.me/", "telegram.me/", "www.t.me/", "www.telegram.me/"):
        if lower.startswith(host):
            return "https://" + s

    # 3. @handle — strip the @ and build a t.me URL.
    if s.startswith("@"):
        handle = s[1:]
        if not _TELEGRAM_USERNAME_RE.match(handle):
            raise ValueError(
                f"'{s}' is not a valid Telegram handle (5–32 chars, starts with a letter)."
            )
        return f"https://t.me/{handle}"

    # 4. Bare username — only accept if it matches the Telegram pattern,
    #    otherwise we'd be guessing too aggressively for arbitrary words.
    if _TELEGRAM_USERNAME_RE.match(s):
        return f"https://t.me/{s}"

    raise ValueError(
        "Input must be a URL (http://...), a Telegram handle (@username), "
        "or a t.me/... link."
    )


class ScanRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def normalise(cls, v: str) -> str:
        return _normalise_to_url(v)


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


class ScamTypeDetail(BaseModel):
    category: ScamCategory
    confidence: float
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
    scam_type: ScamTypeDetail | None = None
    scam: ScamDetail | None = None

    # Final verdict
    verdict: Verdict | None = None
    evidence_summary: str | None = None

