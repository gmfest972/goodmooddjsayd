"""FREK-ID outbox + dispatcher. Synchronous best-effort call with retry queue.

Contract (as defined in Good Mood OS spec, section 8):
POST {FREK_ID_URL}/frek-id/events
{
  "source": "good-mood-os",
  "interaction_type": "purchase" | "entry_scan",
  "identifier": {"email": "...", "external_id": "gm-fan-..."},
  "event": {"event_id": "...", "event_name": "...", "city": "...", "date": "..."},
  "ticket_type": "VIP",
  "timestamp": "..."
}

If FREK_ID_URL is empty (socle not up yet) → straight to outbox.
If configured → sync POST with 3s timeout, on any failure → outbox with retry.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

RETRY_BACKOFFS_SEC = [30, 120, 600, 3600, 21600]  # 30s, 2m, 10m, 1h, 6h then give up


def _url() -> str:
    return (os.environ.get("FREK_ID_URL") or "").rstrip("/")


def _token() -> str:
    return os.environ.get("FREK_ID_TOKEN", "")


async def _post(payload: dict) -> tuple[bool, Optional[str]]:
    """Actually try to POST. Returns (success, error_msg)."""
    url = _url()
    if not url:
        return False, "no FREK_ID_URL configured"
    headers = {"Content-Type": "application/json"}
    if _token():
        headers["Authorization"] = f"Bearer {_token()}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.post(f"{url}/frek-id/events", json=payload, headers=headers)
        if 200 <= r.status_code < 300:
            return True, None
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


async def emit(db, *, interaction_type: str, email: str, external_id: str,
               event_id: str, event_name: str, city: str, event_date: str,
               ticket_type: Optional[str] = None) -> str:
    """Best-effort synchronous emit. Always persists to outbox with proper status.
    Returns status: 'delivered' | 'queued'.
    """
    payload = {
        "source": "good-mood-os",
        "interaction_type": interaction_type,
        "identifier": {"email": email, "external_id": external_id},
        "event": {
            "event_id": event_id,
            "event_name": event_name,
            "city": city,
            "date": event_date,
        },
        "ticket_type": ticket_type or "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    ok, err = await _post(payload)
    doc = {
        "payload": payload,
        "interaction_type": interaction_type,
        "target_url": _url(),
        "status": "delivered" if ok else "pending",
        "attempts": 1,
        "last_error": err,
        "next_attempt_at": None if ok else (datetime.now(timezone.utc) + timedelta(seconds=RETRY_BACKOFFS_SEC[0])).isoformat(),
        "delivered_at": datetime.now(timezone.utc).isoformat() if ok else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.frek_id_outbox.insert_one(doc)
    return doc["status"]


async def retry_loop(db):
    """Background task: retry pending outbox entries."""
    logger.info("frek_id retry loop started")
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            cursor = db.frek_id_outbox.find({
                "status": "pending",
                "next_attempt_at": {"$lte": now},
            }).sort("created_at", 1).limit(20)
            async for doc in cursor:
                ok, err = await _post(doc["payload"])
                attempts = int(doc.get("attempts", 1)) + 1
                if ok:
                    await db.frek_id_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"status": "delivered", "attempts": attempts,
                                  "last_error": None, "next_attempt_at": None,
                                  "delivered_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    continue
                if attempts > len(RETRY_BACKOFFS_SEC):
                    await db.frek_id_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"status": "failed", "attempts": attempts,
                                  "last_error": f"Max retries exhausted: {err}"}}
                    )
                else:
                    backoff = RETRY_BACKOFFS_SEC[min(attempts - 1, len(RETRY_BACKOFFS_SEC) - 1)]
                    await db.frek_id_outbox.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"attempts": attempts, "last_error": err,
                                  "next_attempt_at": (datetime.now(timezone.utc) + timedelta(seconds=backoff)).isoformat()}}
                    )
        except Exception as e:  # noqa: BLE001
            logger.warning("frek_id retry loop iteration error: %s", e)
        await asyncio.sleep(30)
