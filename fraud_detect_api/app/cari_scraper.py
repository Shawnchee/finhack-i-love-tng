"""
Cari forum scraper using camoufox for Cloudflare bypass.

Supports:
  - https://b.cari.com.my  (BM forum)
  - https://c.cari.com.my  (ZH forum)

camoufox (fingerprint-patched Firefox) executes Cloudflare's managed-challenge
JS so the challenge clears automatically before we read the page HTML.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlencode, urlparse

from bs4 import BeautifulSoup, Tag
from camoufox.async_api import AsyncCamoufox

logger = logging.getLogger(__name__)

_CF_SETTLE_SECS = 2.0
_MAX_COMMENTS = 50
_MAX_PAGES = 5
_REQUEST_DELAY = 1.5
_TIMEOUT_SECS = 30


def _parse_discuz_datetime(text: str) -> float:
    text = text.strip()
    # Strip leading label like "发表于 " or "Posted on "
    text = re.sub(r"^[\w\s]+于\s*", "", text).strip()
    text = re.sub(r"^posted\s+on\s+", "", text, flags=re.IGNORECASE).strip()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d %H:%M", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC).timestamp()
        except ValueError:
            continue
    return datetime.now(UTC).timestamp()


def _fragment_to_text(tag: Tag) -> str:
    for quote in tag.select(".quote, blockquote"):
        quote.decompose()
    return tag.get_text(" ", strip=True)


def _extract_total_pages(soup: BeautifulSoup) -> int:
    max_page = 1
    for link in soup.select(".pg a[href*='page=']"):
        href = str(link.get("href", ""))
        page = parse_qs(urlparse(href).query).get("page", ["1"])[0]
        if page.isdigit():
            max_page = max(max_page, int(page))
    current = soup.select_one(".pg strong")
    if current:
        text = current.get_text(strip=True)
        if text.isdigit():
            max_page = max(max_page, int(text))
    return max_page


def _extract_thread_id(url: str) -> str | None:
    parsed = urlparse(url)
    tid = parse_qs(parsed.query).get("tid", [None])[0]
    if tid:
        return tid
    match = re.search(r"thread-(\d+)", parsed.path)
    return match.group(1) if match else None


def _parse_thread_posts(soup: BeautifulSoup) -> list[dict]:
    posts: list[dict] = []
    for container in soup.select("div[id^='post_']"):
        comment_id = str(container.get("id", "")).replace("post_", "", 1)
        message = container.select_one("td[id^='postmessage_']")
        if not comment_id or message is None:
            continue

        name_link = container.select_one(".pls .authi a.xw1, .pls .authi a.xi2")
        if name_link:
            author = name_link.get_text(" ", strip=True)
        else:
            avatar_box = container.select_one(".pls .pi")
            raw = avatar_box.get_text(" ", strip=True) if avatar_box else ""
            author = raw.split()[0] if raw else "[unknown]"

        created_node = container.select_one("em[id^='authorposton']")
        created_text = created_node.get_text(" ", strip=True) if created_node else ""

        body = _fragment_to_text(message)
        if not body:
            continue

        posts.append(
            {
                "comment_id": comment_id,
                "author": author or "[unknown]",
                "body": body,
                "created_utc": _parse_discuz_datetime(created_text),
            }
        )
    return posts


async def _load_page(browser_page, url: str) -> str | None:
    try:
        await browser_page.goto(
            url, wait_until="networkidle", timeout=_TIMEOUT_SECS * 1000
        )
        await asyncio.sleep(_CF_SETTLE_SECS)
        return await browser_page.content()
    except Exception as exc:
        logger.warning("[cari] Page load failed for %s: %s", url, exc)
        return None


async def scrape_cari_thread(url: str) -> tuple[str, str]:
    """
    Scrape a cari.com.my thread URL via camoufox.

    Returns (title, body) where body is formatted with OP and top comments.
    Raises ValueError if the URL does not contain a recognisable thread ID.
    """
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    thread_id = _extract_thread_id(url)
    if not thread_id:
        raise ValueError(f"Could not extract thread ID from Cari URL: {url}")

    title = ""
    parts: list[str] = []
    comments_collected = 0

    async with AsyncCamoufox(headless=True, geoip=False) as browser:
        page = await browser.new_page()

        for page_no in range(1, _MAX_PAGES + 1):
            params: dict[str, str] = {"mod": "viewthread", "tid": thread_id}
            if page_no > 1:
                params["page"] = str(page_no)
            page_url = f"{base_url}/forum.php?{urlencode(params)}"

            html = await _load_page(page, page_url)
            if html is None:
                break

            soup = BeautifulSoup(html, "html.parser")
            total_pages = _extract_total_pages(soup)

            if page_no == 1:
                title_node = soup.select_one("#thread_subject")
                if title_node:
                    title = title_node.get_text(" ", strip=True)

            posts = _parse_thread_posts(soup)
            if not posts:
                break

            if page_no == 1:
                op = posts[0]
                parts.append(f"[POST TITLE] {title}")
                parts.append(f"[POST BODY | {op['author']}]\n{op['body']}")
                posts = posts[1:]

            if parts and comments_collected == 0 and posts:
                parts.append("[COMMENTS]")

            for post in posts:
                if comments_collected >= _MAX_COMMENTS:
                    break
                parts.append(f"[{post['author']}] {post['body']}")
                comments_collected += 1

            if comments_collected >= _MAX_COMMENTS or page_no >= total_pages:
                break

            await asyncio.sleep(_REQUEST_DELAY)

    return title, "\n\n".join(parts)
