"""Generates 4 personas with realistic 90-day transaction histories.

Output:
  data/users.json          — user metadata
  data/transactions.json   — all transactions across all users, sorted by timestamp

Personas (design doc section 5):
  user_001 Aisyah      — office worker, Bangsar South   — scenario: love-scam CHALLENGE
  user_002 Ahmad       — Grab driver, KL                — scenario: phone-theft velocity BLOCK
  user_003 Wei         — student, IOI City              — scenario: ALLOW then NOTIFY
  user_004 Mak Timah   — retiree, Kajang                — scenario: PDRM scam BLOCK

Run:
  python -m scripts.generate_synthetic_data
"""
from __future__ import annotations

import json
import random
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

MYT = timezone(timedelta(hours=8))  # Malaysia Time

SEED = 42
END_DATE = date(2026, 4, 22)        # last day of history; demo tx come after
HISTORY_DAYS = 90

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


# --- Persona configs -------------------------------------------------------

AISYAH = {
    "user_id": "user_001",
    "name": "Aisyah",
    "persona": "office_worker_bangsar",
    "base_tx_per_day": (2, 5),
    "day_of_week_weight": {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 0.5, 6: 0.3},
    "active_hours": [9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21],
    "amount_mean": 120,
    "amount_stddev": 80,
    "amount_min": 15,
    "amount_max": 800,
    "tx_type_weights": {"qr_payment": 0.68, "duitnow_transfer": 0.22, "bill_payment": 0.10},
    "merchants": [
        ("5551234001", "Starbucks Mid Valley", "qr_payment"),
        ("5551234002", "Village Park Restaurant", "qr_payment"),
        ("5551234003", "Jaya Grocer Bangsar", "qr_payment"),
        ("5551234004", "Pressto Laundry", "qr_payment"),
        ("5551234005", "Grab", "qr_payment"),
        ("5551234006", "Tealive Bangsar", "qr_payment"),
        ("5551234007", "Shell Bangsar", "qr_payment"),
        ("5551234008", "AEON Mont Kiara", "qr_payment"),
    ],
    "recurring": [
        # (day_of_month, amount, account, name, tx_type)
        (1,  1200.0, "2222222222", "Landlord",       "duitnow_transfer"),
        (15,  450.0, "1111111111", "Mak",            "duitnow_transfer"),
        (5,    85.0, "9990000001", "TNB Electric",   "bill_payment"),
        (5,    45.0, "9990000002", "Unifi Internet", "bill_payment"),
    ],
    "frequent_peers": [
        # (account, name, tx_type, probability per transaction)
        ("1111111111", "Mak", "duitnow_transfer", 0.25),
    ],
}

AHMAD = {
    "user_id": "user_002",
    "name": "Ahmad",
    "persona": "grab_driver",
    "base_tx_per_day": (8, 14),
    "day_of_week_weight": {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 0.8},
    "active_hours": [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    "amount_mean": 18,
    "amount_stddev": 12,
    "amount_min": 3,
    "amount_max": 80,
    "tx_type_weights": {"qr_payment": 0.85, "duitnow_transfer": 0.10, "bill_payment": 0.05},
    "merchants": [
        ("7770000001", "Petron KL",           "qr_payment"),
        ("7770000002", "Shell Cheras",        "qr_payment"),
        ("7770000003", "Touch N Go Toll",     "qr_payment"),
        ("7770000004", "McDonald's DT",       "qr_payment"),
        ("7770000005", "Mamak Restoran Ali",  "qr_payment"),
        ("7770000006", "KK Super Mart",       "qr_payment"),
        ("7770000007", "99 Speedmart",        "qr_payment"),
        ("7770000008", "Old Town White Coffee","qr_payment"),
    ],
    "recurring": [
        (10, 180.0, "3333333334", "Car Loan Bank",  "duitnow_transfer"),
        (20, 300.0, "3333333335", "Wife (Siti)",    "duitnow_transfer"),
    ],
    "frequent_peers": [
        ("3333333335", "Wife (Siti)", "duitnow_transfer", 0.4),
    ],
}

WEI = {
    "user_id": "user_003",
    "name": "Wei",
    "persona": "student_ioi",
    "base_tx_per_day": (1, 3),
    "day_of_week_weight": {0: 0.8, 1: 0.9, 2: 0.9, 3: 0.9, 4: 1.0, 5: 1.0, 6: 0.9},
    "active_hours": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    "amount_mean": 22,
    "amount_stddev": 18,
    "amount_min": 5,
    "amount_max": 100,
    "tx_type_weights": {"qr_payment": 0.90, "duitnow_transfer": 0.08, "bill_payment": 0.02},
    "merchants": [
        ("8880000001", "Chatime IOI",       "qr_payment"),
        ("8880000002", "Sushi King IOI",    "qr_payment"),
        ("8880000003", "MyNews",            "qr_payment"),
        ("8880000004", "McDonald's IOI",    "qr_payment"),
        ("8880000005", "Canteen Cafeteria", "qr_payment"),
        ("8880000006", "Tealive IOI",       "qr_payment"),
        ("8880000007", "Daiso IOI",         "qr_payment"),
    ],
    "recurring": [
        (5, 800.0, "4444444444", "Hostel Rent", "duitnow_transfer"),
    ],
    "frequent_peers": [
        ("4444444445", "Friend (Jia Hui)", "duitnow_transfer", 0.3),
    ],
}

MAK_TIMAH = {
    "user_id": "user_004",
    "name": "Mak Timah",
    "persona": "retiree_kajang",
    "base_tx_per_day": (1, 1),
    # Tue (1) and Fri (4) only
    "day_of_week_weight": {0: 0.0, 1: 1.0, 2: 0.0, 3: 0.0, 4: 1.0, 5: 0.0, 6: 0.0},
    "active_hours": [10, 11, 12, 13, 14, 15],
    "amount_mean": 100,
    "amount_stddev": 20,
    "amount_min": 50,
    "amount_max": 150,
    "tx_type_weights": {"qr_payment": 1.0, "duitnow_transfer": 0.0, "bill_payment": 0.0},
    "merchants": [
        ("9990000099", "Lotus's Kajang", "qr_payment"),
    ],
    "recurring": [
        (15, 50.0, "5555555555", "Son (Faizal)", "duitnow_transfer"),
    ],
    "frequent_peers": [],
}

PERSONAS = [AISYAH, AHMAD, WEI, MAK_TIMAH]


# --- Sampling helpers ------------------------------------------------------

def _sample_amount(rng: random.Random, cfg: dict) -> float:
    amount = rng.gauss(cfg["amount_mean"], cfg["amount_stddev"])
    amount = max(cfg["amount_min"], min(cfg["amount_max"], amount))
    return round(amount, 2)


def _sample_tx_type(rng: random.Random, cfg: dict) -> str:
    types = list(cfg["tx_type_weights"].keys())
    weights = list(cfg["tx_type_weights"].values())
    return rng.choices(types, weights=weights, k=1)[0]


def _sample_recipient(rng: random.Random, cfg: dict, tx_type: str) -> tuple[str, str]:
    """Returns (account, name). Frequent peers win over merchants when matched."""
    for account, name, peer_type, prob in cfg["frequent_peers"]:
        if peer_type == tx_type and rng.random() < prob:
            return account, name
    candidates = [m for m in cfg["merchants"] if m[2] == tx_type]
    if not candidates:
        candidates = cfg["merchants"]
    merchant = rng.choice(candidates)
    return merchant[0], merchant[1]


def _tx_count_for_day(rng: random.Random, cfg: dict, day_of_week: int) -> int:
    weight = cfg["day_of_week_weight"].get(day_of_week, 1.0)
    low, high = cfg["base_tx_per_day"]
    base = rng.randint(low, high)
    return max(0, round(base * weight))


def _sample_timestamp(rng: random.Random, cfg: dict, d: date) -> datetime:
    hour = rng.choice(cfg["active_hours"])
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return datetime.combine(d, time(hour, minute, second), tzinfo=MYT)


# --- Generation ------------------------------------------------------------

def generate_for_persona(cfg: dict, end: date, days: int) -> list[dict[str, Any]]:
    rng = random.Random(f"{SEED}-{cfg['user_id']}")
    transactions: list[dict[str, Any]] = []

    start = end - timedelta(days=days - 1)

    for i in range(days):
        d = start + timedelta(days=i)
        dow = d.weekday()

        for dom, amount, account, name, tx_type in cfg["recurring"]:
            if d.day == dom:
                hour = rng.choice(cfg["active_hours"])
                ts = datetime.combine(
                    d, time(hour, rng.randint(0, 59), rng.randint(0, 59)), tzinfo=MYT
                )
                transactions.append({
                    "user_id": cfg["user_id"],
                    "recipient_account": account,
                    "recipient_name": name,
                    "amount": round(amount + rng.gauss(0, max(amount * 0.01, 0.5)), 2),
                    "transaction_type": tx_type,
                    "timestamp": ts.isoformat(),
                })

        n = _tx_count_for_day(rng, cfg, dow)
        for _ in range(n):
            tx_type = _sample_tx_type(rng, cfg)
            account, name = _sample_recipient(rng, cfg, tx_type)
            amount = _sample_amount(rng, cfg)
            ts = _sample_timestamp(rng, cfg, d)
            transactions.append({
                "user_id": cfg["user_id"],
                "recipient_account": account,
                "recipient_name": name,
                "amount": amount,
                "transaction_type": tx_type,
                "timestamp": ts.isoformat(),
            })

    transactions.sort(key=lambda t: t["timestamp"])
    return transactions


def main() -> None:
    random.seed(SEED)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    users: dict[str, dict[str, str]] = {}
    all_tx: list[dict[str, Any]] = []

    for cfg in PERSONAS:
        tx = generate_for_persona(cfg, END_DATE, HISTORY_DAYS)
        users[cfg["user_id"]] = {
            "user_id": cfg["user_id"],
            "name": cfg["name"],
            "persona": cfg["persona"],
        }
        all_tx.extend(tx)
        print(f"  {cfg['user_id']}  {cfg['name']:<10}  ->  {len(tx):>4} transactions")

    all_tx.sort(key=lambda t: (t["user_id"], t["timestamp"]))

    (DATA_DIR / "users.json").write_text(
        json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (DATA_DIR / "transactions.json").write_text(
        json.dumps(all_tx, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nTotal: {len(all_tx)} transactions across {len(users)} users")
    print(f"Wrote {DATA_DIR / 'users.json'}")
    print(f"Wrote {DATA_DIR / 'transactions.json'}")


if __name__ == "__main__":
    main()
