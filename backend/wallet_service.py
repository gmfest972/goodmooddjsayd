"""CVLN Wallet outbox + dispatcher. Same mechanic as frek_service but posts
the freshly-issued ticket to the CVLN wallet endpoint.

If WALLET_URL is empty (endpoint not ready yet) → straight to outbox.
Payload contract to be finalised with wallet team — this is a reasonable draft.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

RETRY_BACKOFFS_SEC = [30, 120, 600, 3600, 21600]


def _url() -> str:
    return (os.environ.get("WALLET_URL") or "").rstrip("/")


def _token() -> str:
    return os.environ.get("WALLET_TOKEN", "")


async def _post(payload: dict) -> tuple[bool, Optional[str]]:
    url = _url()
    if not url:
        return False, "no WALLET_URL configured"
    headers = {"Content-Type": "application/json"}
    if _token():
        headers["Authorization"] = f"Bearer {_token()}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.post(f"{url}/wallet/tickets", json=payload, headers=headers)
        if 200 <= r.status_code < 300:
            return True, None
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


async def push_ticket(db, *, ticket_id: str, email: str, event_id: str,
                     event_name: str, city: str, venue: str, event_date: str,
                     ticket_type: str, qr_url: str, view_url: str) -> str:
    payload = {
        "source": "good-mood-os",
        "wallet_action": "push_ticket",
        "identifier": {"email": email},
        "ticket": {
            "ticket_id": ticket_id,
            "event_id": event_id,
            "event_name": event_name,
            "city": city,
            "venue": venue,
            "date": event_date,
            "type": ticket_type,
            "qr_url": qr_url,
            "view_url": view_url,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    ok, err = await _post(payload)
    doc = {
        "ticket_id": ticket_id,
        "payload": payload,
        "target_url": _url(),
        "status": "delivered" if ok else "pending",
        "attempts": 1,
        "last_error": err,
        "next_attempt_at": None if ok else (datetime.now(timezone.utc) + timedelta(seconds=RETRY_BACKOFFS_SEC[0])).isoformat(),
        "delivered_at": datetime.now(timezone.utc).isoformat() if ok else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wallet_outbox.insert_one(doc)
    return doc["status"]


async def retry_loop(db):
    logger.info("wallet retry loop started")
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            cursor = db.wallet_outbox.find({
                "status": "pending",
                "next_attempt_at": {"$lte": now},
            }).sort("created_at", 1).limit(20)
            async for doc in cursor:
                ok, err = await _post(doc["payload"])
                attempts = int(doc.get("attempts", 1)) + 1
                if ok:
                    await db.wallet_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"status": "delivered", "attempts": attempts,
                                  "last_error": None, "next_attempt_at": None,
                                  "delivered_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    continue
                if attempts > len(RETRY_BACKOFFS_SEC):
                    await db.wallet_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"status": "failed", "attempts": attempts,
                                  "last_error": f"Max retries exhausted: {err}"}}
                    )
                else:
                    backoff = RETRY_BACKOFFS_SEC[min(attempts - 1, len(RETRY_BACKOFFS_SEC) - 1)]
                    await db.wallet_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"attempts": attempts, "last_error": err,
                                  "next_attempt_at": (datetime.now(timezone.utc) + timedelta(seconds=backoff)).isoformat()}}
                    )
        except Exception as e:  # noqa: BLE001
            logger.warning("wallet retry loop iteration error: %s", e)
        await asyncio.sleep(30)
