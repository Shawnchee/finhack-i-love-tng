"""
Telegram scraper using Telethon (MTProto API).

Required credentials (set in .env):
  TELEGRAM_API_ID    — from https://my.telegram.org → API development tools
  TELEGRAM_API_HASH  — same source
  TELEGRAM_SESSION_STRING — pre-generated session string (see below)

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

Supported URL formats:
  https://t.me/{username}/{message_id}
  https://t.me/c/{chat_id}/{message_id}
  https://t.me/{username}
"""

from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_MAX_REPLIES = 50


def _parse_telegram_url(url: str) -> tuple[str | int, int | None]:
    parsed = urlparse(url)
    segments = [s for s in parsed.path.strip("/").split("/") if s]

    if len(segments) >= 3 and segments[0] == "c":
        chat_id = int(f"-100{segments[1]}")
        msg_id = int(segments[2]) if segments[2].isdigit() else None
        return chat_id, msg_id

    if len(segments) >= 2 and segments[1].isdigit():
        return segments[0], int(segments[1])

    if len(segments) == 1:
        return segments[0], None

    raise ValueError(f"Unrecognised Telegram URL format: {url}")


async def scrape_telegram_post(url: str) -> tuple[str, str]:
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
        raise ValueError(
            "TELEGRAM_SESSION_STRING is not set. Generate one locally via "
            "the snippet in this module's docstring, then add it to .env."
        )
    session = StringSession(session_string)

    entity, message_id = _parse_telegram_url(url)

    async with TelegramClient(session, api_id, api_hash) as client:
        if not await client.is_user_authorized():
            raise ValueError(
                "TELEGRAM_SESSION_STRING is set but not authorised — regenerate "
                "it locally and update .env."
            )

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

        if message_id is not None:
            msgs = await client.get_messages(tg_entity, ids=message_id)
            message: Message | None = msgs if isinstance(msgs, Message) else None
        else:
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
