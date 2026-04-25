"""
Web scraper routing strategy:
  - Reddit     → asyncpraw OAuth API
  - Telegram   → Telethon MTProto API
  - TikTok     → oEmbed API + Playwright fallback
  - Cari       → camoufox (Cloudflare bypass)
  - JS-heavy   → Playwright
  - Everything else → httpx first, Playwright fallback if thin
  - Blocked    → ValueError (Twitter, Instagram)
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import re
import unicodedata
from urllib.parse import urlparse

import asyncpraw
import httpx
import trafilatura
from playwright.async_api import Browser

from backend.services.fraud_scan.cari_scraper import scrape_cari_thread
from backend.services.fraud_scan.keywords import match_keywords
from backend.services.fraud_scan.telegram_scraper import scrape_telegram_post
from backend.services.fraud_scan.tiktok_scraper import scrape_tiktok_video

logger = logging.getLogger(__name__)

_MIN_CONTENT_CHARS = 200

_JS_DOMAINS: frozenset[str] = frozenset({"youtube.com", "linkedin.com"})
_TIKTOK_DOMAINS: frozenset[str] = frozenset({"tiktok.com"})
_TELEGRAM_DOMAINS: frozenset[str] = frozenset(
    {"t.me", "telegram.me", "web.telegram.org"}
)
_BLOCKED_DOMAINS: frozenset[str] = frozenset(
    {"twitter.com", "x.com", "facebook.com", "instagram.com"}
)

_PLATFORM_MAP: dict[str, str] = {
    "reddit.com": "reddit",
    "t.me": "telegram",
    "telegram.me": "telegram",
    "web.telegram.org": "telegram",
    "youtube.com": "youtube",
    "linkedin.com": "linkedin",
    "tiktok.com": "tiktok",
    "medium.com": "blog",
    "substack.com": "blog",
    "wordpress.com": "blog",
    "blogspot.com": "blog",
    "lowyat.net": "lowyat",
    "cari.com.my": "cari",
}

_HTTPX_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_RE_WHITESPACE = re.compile(r"[\t\r\f\v]")
_RE_ZERO_WIDTH = re.compile(r"[​-‏⁠﻿]")
_RE_MULTI_SPACE = re.compile(r" +")
_RE_MULTI_NEWLINE = re.compile(r"\n{3,}")


def _clean(text: str) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = unicodedata.normalize("NFKC", text)
    text = _RE_WHITESPACE.sub(" ", text)
    text = _RE_ZERO_WIDTH.sub("", text)
    text = (
        text.replace("‘", "'")
        .replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
        .replace("…", "...")
        .replace("\xa0", " ")
    )
    text = _RE_MULTI_SPACE.sub(" ", text)
    text = _RE_MULTI_NEWLINE.sub("\n\n", text)
    return text.strip()


def _netloc(url: str) -> str:
    return urlparse(url).netloc.lower().lstrip("www.")


def detect_platform(url: str) -> str:
    netloc = _netloc(url)
    for fragment, name in _PLATFORM_MAP.items():
        if netloc == fragment or netloc.endswith(f".{fragment}"):
            return name
    return "website"


def _is_blocked(url: str) -> bool:
    netloc = _netloc(url)
    return any(netloc == d or netloc.endswith(f".{d}") for d in _BLOCKED_DOMAINS)


def _is_reddit(url: str) -> bool:
    netloc = _netloc(url)
    return netloc == "reddit.com" or netloc.endswith(".reddit.com")


def _is_telegram(url: str) -> bool:
    netloc = _netloc(url)
    return any(netloc == d or netloc.endswith(f".{d}") for d in _TELEGRAM_DOMAINS)


def _is_tiktok(url: str) -> bool:
    netloc = _netloc(url)
    return any(netloc == d or netloc.endswith(f".{d}") for d in _TIKTOK_DOMAINS)


def _is_cari(url: str) -> bool:
    netloc = _netloc(url)
    return netloc == "cari.com.my" or netloc.endswith(".cari.com.my")


def _needs_javascript(url: str) -> bool:
    netloc = _netloc(url)
    return any(netloc == d or netloc.endswith(f".{d}") for d in _JS_DOMAINS)


def _make_post_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:12]


class ScrapeResult:
    def __init__(
        self,
        url: str,
        platform: str,
        title: str,
        body: str,
        used_javascript: bool,
        post_id: str | None = None,
    ) -> None:
        self.post_id = post_id or _make_post_id(url)
        self.url = url
        self.platform = platform
        self.title = title
        self.body = body
        self.used_javascript = used_javascript
        self.keywords_matched = match_keywords(f"{title} {body}")


class _RedditScraper:
    def __init__(self) -> None:
        client_id = os.getenv("REDDIT_CLIENT_ID", "")
        client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
        if client_id and client_secret:
            self._praw_creds: dict | None = {
                "client_id": client_id,
                "client_secret": client_secret,
                "user_agent": "thread-analyzer",
            }
            logger.info("[Reddit] Backend: asyncpraw (OAuth)")
        else:
            self._praw_creds = None
            logger.warning("[Reddit] REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set.")

    async def fetch_post(self, url: str) -> ScrapeResult:
        if self._praw_creds is None:
            raise ValueError(
                "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in .env."
            )

        async with asyncpraw.Reddit(**self._praw_creds) as reddit:
            logger.info("[Reddit/PRAW] Fetching post: %s", url)
            submission = await reddit.submission(url=url)
            await submission.load()

            title = _clean(submission.title or "")
            selftext = _clean(submission.selftext or "")
            post_id = submission.id

            comment_lines: list[str] = []
            try:
                await submission.comments.replace_more(limit=0)
                top_level = list(submission.comments)[:50]
                comment_lines = self._parse_comments(top_level, depth=0, max_depth=3)
            except Exception as exc:
                logger.warning(
                    "[Reddit/PRAW] Comment fetch failed for %s: %s", url, exc
                )

            parts: list[str] = [f"[POST TITLE] {title}"]
            if selftext:
                parts.append(f"[POST BODY] {selftext}")
            if comment_lines:
                parts.append("[COMMENTS]")
                parts.extend(comment_lines)

            body = "\n\n".join(p for p in parts if p)
            return ScrapeResult(
                url=url,
                platform="reddit",
                title=title,
                body=body,
                used_javascript=False,
                post_id=post_id,
            )

    def _parse_comments(
        self, comment_list: list, depth: int, max_depth: int
    ) -> list[str]:
        lines: list[str] = []
        for c in comment_list:
            if not hasattr(c, "body"):
                continue
            body = _clean(c.body)
            if not body or body in ("[deleted]", "[removed]"):
                continue
            author = c.author.name if c.author else "[deleted]"
            indent = "  " * depth
            lines.append(f"{indent}[{author} | score:{c.score}] {body}")
            if depth < max_depth:
                replies_forest = getattr(c, "replies", None)
                if replies_forest is not None:
                    lines.extend(
                        self._parse_comments(list(replies_forest), depth + 1, max_depth)
                    )
        return lines


_reddit_scraper = _RedditScraper()


def _extract_text(html_content: str, url: str) -> tuple[str, str]:
    raw = trafilatura.extract(
        html_content,
        output_format="json",
        with_metadata=True,
        include_comments=True,
        include_tables=True,
        favor_recall=True,
    )
    if not raw:
        return "", ""
    data = json.loads(raw)
    title = (data.get("title") or "").strip()
    text = (data.get("text") or "").strip()
    return title, text


async def _fetch_httpx(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            headers=_HTTPX_HEADERS, follow_redirects=True, timeout=20.0
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception as exc:
        logger.debug("httpx fetch failed for %s: %s", url, exc)
        return None


async def _fetch_playwright(url: str, browser: Browser) -> str:
    context = await browser.new_context(
        user_agent=_HTTPX_HEADERS["User-Agent"],
        locale="en-US",
        viewport={"width": 1920, "height": 1080},
    )
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1500)
        return await page.content()
    finally:
        await page.close()
        await context.close()


async def scrape(url: str, browser: Browser) -> ScrapeResult:
    if _is_blocked(url):
        netloc = _netloc(url)
        raise ValueError(
            f"{netloc} requires authentication and is not supported. "
            "Supported: Reddit, Telegram, YouTube, LinkedIn, TikTok, public websites."
        )

    if _is_reddit(url):
        return await _reddit_scraper.fetch_post(url)

    if _is_telegram(url):
        logger.info("[telegram] Scraping via Telethon MTProto: %s", url)
        title, body = await scrape_telegram_post(url)
        return ScrapeResult(url, "telegram", title, body, used_javascript=False)

    if _is_tiktok(url):
        logger.info("[tiktok] Fetching via oEmbed: %s", url)
        title, body = await scrape_tiktok_video(url, browser=browser)
        return ScrapeResult(url, "tiktok", title, body, used_javascript=False)

    if _is_cari(url):
        logger.info("[cari] Scraping via camoufox: %s", url)
        title, body = await scrape_cari_thread(url)
        return ScrapeResult(url, "cari", title, body, used_javascript=True)

    platform = detect_platform(url)
    use_js = _needs_javascript(url)

    if not use_js:
        html_content = await _fetch_httpx(url)
        if html_content:
            title, body = _extract_text(html_content, url)
            if len(body) >= _MIN_CONTENT_CHARS:
                return ScrapeResult(url, platform, title, body, used_javascript=False)
            logger.info(
                "httpx content too thin (%d chars) for %s, retrying with Playwright",
                len(body),
                url,
            )

    html_content = await _fetch_playwright(url, browser)
    title, body = _extract_text(html_content, url)
    return ScrapeResult(url, platform, title, body, used_javascript=True)
