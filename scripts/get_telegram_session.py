"""
One-off: print a Telethon StringSession so you can paste it into .env as
TELEGRAM_SESSION (and avoid re-authenticating on every container restart).

Run interactively from a real terminal — Telegram will SMS a code and you
must type it in:

    .venv/bin/python scripts/get_telegram_session.py

Requires .env at the repo root with TELEGRAM_API_ID, TELEGRAM_API_HASH,
TELEGRAM_PHONE.
"""

from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

load_dotenv()


async def main() -> None:
    api_id = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    phone = os.environ["TELEGRAM_PHONE"]

    async with TelegramClient(StringSession(), api_id, api_hash) as client:
        await client.start(phone=phone)
        print("\n=== Session string (copy into .env as TELEGRAM_SESSION) ===\n")
        print(client.session.save())
        print()


if __name__ == "__main__":
    asyncio.run(main())
