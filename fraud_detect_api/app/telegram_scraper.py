"""
Telegram scraper using Telethon (MTProto API).

Avoids IP blocks on AWS by using Telegram's official MTProto protocol
instead of scraping the t.me web preview with Playwright.

Required credentials (set in .env):
  TELEGRAM_API_ID    — from https://my.telegram.org → API development tools
  TELEGRAM_API_HASH  — same source
  TELEGRAM_PHONE     — your phone number, e.g. +601XXXXXXXX
                       First run only: Telegram will send an OTP to confirm.
                       After that a session file (telegram.session) is saved
                       and TELEGRAM_PHONE is no longer prompted.

For headless / server deployment (recommended):
  Generate a session string once on your local machine:

    python - <<'EOF'
    import asyncio
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    import os; from dotenv import load_dotenv; load_dotenv()
    async def main():
        async with TelegramClient(StringSession(), int(os.environ["TELEGRAM_API_ID"]),
                                  os.environ["TELEGRAM_API_HASH"]) as c:
            await c.start(phone=os.environ["TELEGRAM_PHONE"])
            print("Session string:", c.session.save())
    asyncio.run(main())
    EOF

  Then set TELEGRAM_SESSION_STRING=1BVtsOIUBu68AwzrKP74NIUNQvuPczaVqFTIFhC1l-1ne6ugmeswGrk-0V8-7-sKJ-Dh2YduQ7GjLeCG5bJgIJyrmmKllF1Rj79umIZmB6ev71fRqnHs20XWf_XlviyUyEB6eYc6Ma2SCa6F-YFgtBhHlWUjwEyW10cw2GL3Q2ur26NgQEUrxDTf7HSK-9uCtr4vJrK6x_0Qxl4BuoXCaaJtF3-KpSNLPBDtD7kqbv-jUU0QJeO0H2BPZHD3dL_kJdDm4QC1DTDIxSq26tDhf3D-5bhVtcgTwlxm8KcVqv1b__d2k7mB5kx2EZs-ERuMGWl3DwDLsh81hSwo4DMP5uJnbyheI63c= in .env — no interactive prompt
  ever again and no session file written to disk.

Supported URL formats:
  https://t.me/{username}/{message_id}          — public channel/group post
  https://t.me/c/{chat_id}/{message_id}         — supergroup (numeric chat ID)
  https://t.me/{username}                        — channel (fetches latest post)
"""

from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_MAX_REPLIES = 50


# ---------------------------------------------------------------------------
# URL parsing
# ---------------------------------------------------------------------------

def _parse_telegram_url(url: str) -> tuple[str | int, int | None]:
    """
    Parse a t.me URL into (entity, message_id).

    entity     — channel username (str) or numeric supergroup ID (int)
    message_id — int or None when no specific message is in the URL
    """
    parsed = urlparse(url)
    segments = [s for s in parsed.path.strip("/").split("/") if s]

    # t.me/c/{chat_id}/{msg_id}  — supergroup numeric form
    if len(segments) >= 3 and segments[0] == "c":
        chat_id = int(f"-100{segments[1]}")  # Telethon expects -100<chat_id>
        msg_id = int(segments[2]) if segments[2].isdigit() else None
        return chat_id, msg_id

    # t.me/{username}/{msg_id}
    if len(segments) >= 2 and segments[1].isdigit():
        return segments[0], int(segments[1])

    # t.me/{username}  — no specific message
    if len(segments) == 1:
        return segments[0], None

    raise ValueError(f"Unrecognised Telegram URL format: {url}")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def scrape_telegram_post(url: str) -> tuple[str, str]:
    """
    Fetch a Telegram channel post (and its replies) via Telethon MTProto.

    Returns (title, body) formatted for LLM classification.
    Raises ValueError if credentials are missing or the post cannot be fetched.
    """
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.tl.functions.messages import GetRepliesRequest
    from telethon.tl.types import Message

    api_id_raw = os.getenv("TELEGRAM_API_ID", "")
    api_hash = os.getenv("TELEGRAM_API_HASH", "")
    if not api_id_raw or not api_hash:
        raise ValueError(
            "TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env. "
            "Get them at https://my.telegram.org → API development tools."
        )
    api_id = int(api_id_raw)

    session_string = os.getenv("TELEGRAM_SESSION_STRING", "")
    if not session_string:
        # client.start(phone=...) calls Python's blocking input() to prompt for
        # the OTP, which hangs the whole asyncio event loop under uvicorn — no
        # human can type into a detached overmind/tmux pane. Refuse fast.
        raise ValueError(
            "TELEGRAM_SESSION_STRING is not set. Generate one locally via "
            "the snippet in app/telegram_scraper.py's module docstring, then "
            "add it to .env. Interactive phone-OTP auth is not supported in "
            "the server runtime."
        )
    session = StringSession(session_string)

    entity, message_id = _parse_telegram_url(url)

    async with TelegramClient(session, api_id, api_hash) as client:
        if not await client.is_user_authorized():
            raise ValueError(
                "TELEGRAM_SESSION_STRING is set but not authorised — regenerate "
                "it locally and update .env."
            )

        # ── Resolve entity ──────────────────────────────────────────────────
        try:
            tg_entity = await client.get_entity(entity)
        except Exception as exc:
            raise ValueError(
                f"Could not resolve Telegram entity {entity!r}: {exc}"
            ) from exc

        channel_name: str = (
            getattr(tg_entity, "username", None)
            or getattr(tg_entity, "title", None)
            or str(entity)
        )

        # ── Fetch the target message ────────────────────────────────────────
        if message_id is not None:
            msgs = await client.get_messages(tg_entity, ids=message_id)
            message: Message | None = msgs if isinstance(msgs, Message) else None
        else:
            # No specific message — grab the latest post
            history = await client.get_messages(tg_entity, limit=1)
            message = history[0] if history else None

        if message is None or not getattr(message, "text", None):
            raise ValueError(
                f"No readable message found at {url}. "
                "The channel may be private or the message may have been deleted."
            )

        post_text: str = message.text or ""
        msg_url = (
            f"https://t.me/{channel_name}/{message.id}"
            if isinstance(entity, str)
            else f"https://t.me/c/{str(entity).lstrip('-100')}/{message.id}"
        )

        parts: list[str] = [
            f"[POST TITLE] {post_text[:120]}",
            f"[POST BODY | {channel_name}]\n{post_text}",
        ]

        # ── Fetch replies ───────────────────────────────────────────────────
        reply_count = getattr(message.replies, "replies", 0) if message.replies else 0
        if reply_count > 0:
            try:
                result = await client(
                    GetRepliesRequest(
                        peer=tg_entity,
                        msg_id=message.id,
                        offset_id=0,
                        offset_date=None,
                        add_offset=0,
                        limit=_MAX_REPLIES,
                        max_id=0,
                        min_id=0,
                        hash=0,
                    )
                )
                replies = [m for m in result.messages if getattr(m, "text", None)]
                if replies:
                    parts.append("[REPLIES]")
                    for reply in replies:
                        sender_name = await _get_sender_name(client, reply)
                        parts.append(f"[{sender_name}] {reply.text}")
            except Exception as exc:
                logger.warning("[Telegram] Reply fetch failed for %s: %s", url, exc)

        title = post_text[:120]
        body = "\n\n".join(parts)
        return title, body


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _get_sender_name(client, message) -> str:
    try:
        sender = await message.get_sender()
        if sender is None:
            return "unknown"
        return (
            getattr(sender, "username", None)
            or getattr(sender, "first_name", None)
            or "unknown"
        )
    except Exception:
        return "unknown"
