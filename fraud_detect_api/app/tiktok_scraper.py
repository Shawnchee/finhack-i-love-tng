"""
TikTok scraper — oEmbed primary, Playwright fallback.

Strategy for a specific video URL (e.g. tiktok.com/@user/video/123):

  PRIMARY — TikTok oEmbed API (no auth, no browser)
    GET https://www.tiktok.com/oembed?url={video_url}
    Returns caption + author as JSON. Fast and reliable.
    Limitation: no comments.

  FALLBACK — Playwright with stealth patches
    Used when oEmbed fails (private/deleted video).
    Applies navigator.webdriver=undefined and window.chrome injection
    to reduce bot-detection. Targets the video page directly and
    attempts to read the caption + visible comments from the DOM.

Why the search-page Playwright approach from the reference sec-scraper works
but direct video-page Playwright does not:
  - tiktok.com/search has lighter bot-detection than video pages.
  - The reference code also applies stealth (navigator.webdriver patch).
  - The reference Playwright mode never fetches real comments — it only reads
    the comment COUNT displayed on each search card. Actual comments only come
    from the Research API (requires approval).
"""

from __future__ import annotations

import logging
import re
import unicodedata

import httpx

logger = logging.getLogger(__name__)

_OEMBED_URL = "https://www.tiktok.com/oembed"
_MAX_COMMENTS = 30
_STEALTH_SCRIPT = """
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
"""
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def scrape_tiktok_video(url: str, browser=None) -> tuple[str, str]:
    """
    Fetch a TikTok video's caption and comments.

    Tries oEmbed first (fast, reliable, caption-only).
    Falls back to Playwright with stealth if oEmbed fails and a browser
    instance is available.

    Returns (title, body) formatted for LLM classification.
    Raises ValueError if neither strategy yields content.
    """
    # ── Primary: oEmbed ───────────────────────────────────────────────
    try:
        return await _scrape_via_oembed(url)
    except ValueError as exc:
        logger.warning("[tiktok] oEmbed failed (%s) — trying Playwright fallback", exc)

    # ── Fallback: Playwright with stealth ─────────────────────────────
    if browser is not None:
        try:
            return await _scrape_via_playwright(url, browser)
        except Exception as exc:
            logger.warning("[tiktok] Playwright fallback failed: %s", exc)

    raise ValueError(
        f"Could not extract content from TikTok video: {url}. "
        "The video may be private, deleted, or region-restricted."
    )


# ---------------------------------------------------------------------------
# Strategy 1: oEmbed
# ---------------------------------------------------------------------------

async def _scrape_via_oembed(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15.0, follow_redirects=True) as client:
        try:
            resp = await client.get(_OEMBED_URL, params={"url": url})
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise ValueError(
                f"TikTok oEmbed returned {exc.response.status_code}"
            ) from exc
        except Exception as exc:
            raise ValueError(f"oEmbed request failed: {exc}") from exc

    caption: str = (data.get("title") or "").strip()
    author_name: str = (data.get("author_name") or "").strip()
    author_id: str = (data.get("author_unique_id") or "").strip()

    if not caption:
        raise ValueError("oEmbed returned no caption")

    author_line = f"@{author_id}" if author_id else author_name
    logger.info("[tiktok] oEmbed: %d-char caption from %s", len(caption), author_line)

    parts = [
        f"[POST TITLE] {caption[:120]}",
        f"[POST BODY | {author_line}]\n{caption}",
        f"[VIDEO URL] {url}",
    ]
    return caption[:120], "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Strategy 2: Playwright with stealth
# ---------------------------------------------------------------------------

async def _scrape_via_playwright(url: str, browser) -> tuple[str, str]:
    """
    Load the video page with stealth patches and extract caption + comments.

    Stealth patches applied (same as reference sec-scraper):
      - navigator.webdriver → undefined
      - window.chrome       → { runtime: {} }
    """
    context = await browser.new_context(
        user_agent=_HEADERS["User-Agent"],
        locale="en-US",
        timezone_id="Asia/Kuala_Lumpur",
        viewport={"width": 1280, "height": 900},
    )
    await context.add_init_script(_STEALTH_SCRIPT)
    page = await context.new_page()

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(3_000)

        # Scroll to trigger lazy-loaded comments
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(2_000)

        # ── Caption ──────────────────────────────────────────────────
        caption = ""
        for selector in [
            '[data-e2e="browse-video-desc"]',
            'h1[data-e2e="video-desc"]',
            'div[class*="DivVideoDesc"]',
            'span[class*="SpanText"]',
        ]:
            el = await page.query_selector(selector)
            if el:
                caption = _clean_text(await el.inner_text())
                if caption:
                    break

        if not caption:
            raise ValueError("Playwright: no caption found in video page DOM")

        # ── Author ───────────────────────────────────────────────────
        author = ""
        for selector in [
            '[data-e2e="browse-username"]',
            'h2[data-e2e="video-author-uniqueid"]',
            'a[data-e2e="video-author-avatar"]',
        ]:
            el = await page.query_selector(selector)
            if el:
                author = _clean_text(await el.inner_text())
                if author:
                    break

        # ── Comments ─────────────────────────────────────────────────
        comment_texts: list[str] = []
        comment_els = await page.query_selector_all(
            '[data-e2e="comment-level-1"], '
            'div[class*="DivCommentItemWrapper"]'
        )
        for el in comment_els[:_MAX_COMMENTS]:
            try:
                text_el = await el.query_selector(
                    '[data-e2e="comment-level-1-text"], span[class*="SpanCommentText"]'
                )
                user_el = await el.query_selector(
                    '[data-e2e="comment-username-1"], a[data-e2e="comment-avatar-1"]'
                )
                text = _clean_text(await text_el.inner_text() if text_el else "")
                user = _clean_text(await user_el.inner_text() if user_el else "")
                if text:
                    comment_texts.append(f"[{user or 'unknown'}] {text}")
            except Exception:
                continue

        logger.info(
            "[tiktok] Playwright: %d-char caption, %d comments",
            len(caption), len(comment_texts),
        )

        author_line = f"@{author}" if author else "unknown"
        parts = [
            f"[POST TITLE] {caption[:120]}",
            f"[POST BODY | {author_line}]\n{caption}",
        ]
        if comment_texts:
            parts.append("[COMMENTS]")
            parts.extend(comment_texts)

        return caption[:120], "\n\n".join(parts)

    finally:
        await page.close()
        await context.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\t\r\f\v]", " ", text)
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
