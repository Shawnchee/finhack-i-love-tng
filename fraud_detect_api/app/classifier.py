"""
LLM-based fraud detector — adapted from sec-scraper/classifier/scam_classifier.py.

Takes a ScrapeResult and returns the classification fields.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

import openai
from dotenv import load_dotenv
from json_repair import repair_json

from app.models import (
    LocalisationDetail,
    RegulatoryDetail,
    ScamCategory,
    ScamDetail,
    ScamTypeDetail,
    Verdict,
)
from app.prompts import SYSTEM_PROMPT, build_user_prompt

load_dotenv()

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 60_000
MAX_TOKENS = 4096
MAX_RETRIES = 3


class ClassificationResult:
    def __init__(
        self,
        regulatory: RegulatoryDetail,
        localisation: LocalisationDetail,
        scam_type: ScamTypeDetail,
        scam: ScamDetail,
        verdict: Verdict,
        evidence_summary: str,
    ) -> None:
        self.regulatory = regulatory
        self.localisation = localisation
        self.scam_type = scam_type
        self.scam = scam
        self.verdict = verdict
        self.evidence_summary = evidence_summary


class FraudDetector:
    """Classifies scraped web content using an OpenAI-compatible LLM endpoint."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        reasoning_effort: str | None = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("LLM_API_KEY", "")
        self._base_url = base_url or os.environ.get("LLM_BASE_URL", "")
        self._model = model or os.environ.get("LLM_MODEL", "ilmu-mini-v3")
        # None means "don't send extra_body"; set LLM_REASONING_EFFORT=low|high to enable
        effort_env = reasoning_effort or os.environ.get("LLM_REASONING_EFFORT", "")
        self._reasoning_effort: str | None = effort_env or None

        self._client = openai.AsyncOpenAI(
            api_key=self._api_key or "no-key",
            base_url=self._base_url or None,
        )

        if not self._api_key:
            logger.warning("LLM_API_KEY is not set — classification will fail.")
        if not self._base_url:
            logger.warning("LLM_BASE_URL is not set — using OpenAI default endpoint.")

    async def classify(self, text: str, platform: str, url: str) -> ClassificationResult | None:
        if len(text) > MAX_CONTENT_CHARS:
            text = text[:MAX_CONTENT_CHARS] + "\n\n[... content truncated ...]"

        user_prompt = build_user_prompt(text, platform, url)
        raw = await self._call_with_retry(user_prompt, url)
        if raw is None:
            return None
        return self._parse(raw)

    async def _call_with_retry(
        self, prompt: str, ref: str, attempt: int = 0
    ) -> str | None:
        kwargs: dict = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": MAX_TOKENS,
            "temperature": 0,
        }
        if self._reasoning_effort:
            kwargs["extra_body"] = {"reasoning": {"effort": self._reasoning_effort}}

        try:
            resp = await self._client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content.strip()
        except openai.BadRequestError as exc:
            # Model doesn't support extra_body reasoning — retry without it
            if self._reasoning_effort and attempt == 0:
                logger.warning("BadRequestError (likely unsupported extra_body), retrying without reasoning: %s", exc)
                self._reasoning_effort = None
                return await self._call_with_retry(prompt, ref, attempt)
            logger.error("BadRequestError for %s: %s", ref, exc)
            return None
        except Exception as exc:
            is_transient = any(
                code in str(exc) for code in ("503", "429", "timeout", "connection")
            )
            if is_transient and attempt < MAX_RETRIES:
                wait = 2**attempt
                logger.warning(
                    "Transient LLM error (attempt %d/%d): %s. Retrying in %ds",
                    attempt + 1, MAX_RETRIES, exc, wait,
                )
                await asyncio.sleep(wait)
                return await self._call_with_retry(prompt, ref, attempt + 1)
            logger.error("LLM call failed for %s after %d attempt(s): %s", ref, attempt + 1, exc)
            return None

    def _parse(self, raw: str) -> ClassificationResult | None:
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            try:
                data = repair_json(raw, return_objects=True)
                if not isinstance(data, dict):
                    raise ValueError("repaired JSON is not a dict")
            except Exception as exc:
                logger.error("JSON parse+repair failed: %s\nRaw (first 300): %s", exc, raw[:300])
                return None

        try:
            reg = data.get("regulatory", {})
            loc = data.get("localisation", {})
            scam = data.get("scam", {})
            scam_type_raw = data.get("scam_type", {}) or {}

            regulatory = RegulatoryDetail(
                is_capital_market=bool(reg.get("is_capital_market", False)),
                product_types=_to_str_list(reg.get("product_types", [])),
                intent=str(reg.get("intent", "general_information")),
                reasoning=str(reg.get("reasoning", "")),
            )
            localisation = LocalisationDetail(
                targets_malaysians=bool(loc.get("targets_malaysians", False)),
                localisation_cues=_to_str_list(loc.get("localisation_cues", [])),
                languages_detected=_to_str_list(loc.get("languages_detected", [])),
                reasoning=str(loc.get("reasoning", "")),
            )
            confidence = max(0.0, min(1.0, float(scam.get("confidence", 0.0))))
            scam_detail = ScamDetail(
                is_scam=bool(scam.get("is_scam", False)),
                confidence=confidence,
                indicators_found=_to_str_list(scam.get("indicators_found", [])),
                indicator_evidence=_to_str_dict(scam.get("indicator_evidence", {})),
                reasoning=str(scam.get("reasoning", "")),
            )
            try:
                category = ScamCategory(
                    str(scam_type_raw.get("category", "UNKNOWN")).upper()
                )
            except ValueError:
                category = ScamCategory.UNKNOWN
            scam_type_confidence = max(
                0.0, min(1.0, float(scam_type_raw.get("confidence", 0.0)))
            )
            scam_type_detail = ScamTypeDetail(
                category=category,
                confidence=scam_type_confidence,
                reasoning=str(scam_type_raw.get("reasoning", "")),
            )
            verdict_raw = str(data.get("verdict", "NEEDS_REVIEW")).upper()
            try:
                verdict = Verdict(verdict_raw)
            except ValueError:
                verdict = Verdict.NEEDS_REVIEW

            return ClassificationResult(
                regulatory=regulatory,
                localisation=localisation,
                scam_type=scam_type_detail,
                scam=scam_detail,
                verdict=verdict,
                evidence_summary=str(data.get("evidence_summary", "")),
            )
        except Exception as exc:
            logger.error("Schema mapping error: %s", exc)
            return None


def _to_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item:
            result.append(item)
        elif isinstance(item, list):
            flat = ", ".join(str(i) for i in item if i)
            if flat:
                result.append(flat)
        elif isinstance(item, dict):
            result.append(json.dumps(item, ensure_ascii=False))
        elif item is not None:
            result.append(str(item))
    return result


def _to_str_dict(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(k): str(v) for k, v in value.items()}
