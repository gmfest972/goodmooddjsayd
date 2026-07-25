"""Ticketing helpers: QR generation, fan CRM upsert, event status auto-flip."""
import io
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from datetime import datetime, timezone


def generate_qr_png(payload: str) -> bytes:
    """Generate a PNG image (bytes) encoding `payload` (typically the ticket_id)."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#050505", back_color="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def upsert_fan(db, *, email: str, name: str = "",
                    event_id: str, event_name: str, event_date: str,
                    city: str, ticket_type: str) -> dict:
    """Create or update a fan doc. Recomputes segments."""
    email = email.lower()
    now = datetime.now(timezone.utc).isoformat()
    purchase = {
        "event_id": event_id,
        "event_name": event_name,
        "event_date": event_date,
        "city": city,
        "ticket_type": ticket_type,
        "purchased_at": now,
    }
    fan = await db.fans.find_one({"email": email}, {"_id": 0})
    if fan is None:
        fan = {
            "email": email,
            "external_id": f"gm-fan-{email.split('@')[0]}",
            "name": name or "",
            "purchases": [purchase],
            "total_events": 1,
            "cities": [city],
            "segments": ["primo"],
            "created_at": now,
            "updated_at": now,
        }
        if ticket_type and ticket_type.upper().startswith("VIP"):
            fan["segments"].append("vip")
        await db.fans.insert_one(fan)
        return fan

    purchases = fan.get("purchases", []) + [purchase]
    cities = sorted(set(fan.get("cities", []) + [city]))
    segments = ["primo"] if len(purchases) == 1 else ["recurring"]
    if any((p.get("ticket_type") or "").upper().startswith("VIP") for p in purchases):
        if "vip" not in segments:
            segments.append("vip")
    update = {
        "purchases": purchases,
        "total_events": len(purchases),
        "cities": cities,
        "segments": segments,
        "updated_at": now,
    }
    if name and not fan.get("name"):
        update["name"] = name
    await db.fans.update_one({"email": email}, {"$set": update})
    fan.update(update)
    return fan


async def maybe_flip_event_to_soldout(db, event_id: str) -> bool:
    """If all active ticket types have sold >= quota, flip event to 'sold_out'."""
    types = await db.ticket_types.find({"event_id": event_id}, {"_id": 0}).to_list(200)
    if not types:
        return False
    all_sold = all((tt.get("sold", 0) or 0) >= (tt.get("quota", 0) or 0) for tt in types)
    if all_sold:
        await db.events.update_one({"id": event_id}, {"$set": {"status": "sold_out"}})
    return all_sold
