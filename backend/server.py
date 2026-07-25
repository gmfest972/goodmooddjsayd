from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import io
import csv
import bcrypt
import jwt
import stripe
import asyncio
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from email_service import send_newsletter_welcome, send_order_confirmation, send_ticket_confirmation
import frek_service
import wallet_service
from ticketing_service import generate_qr_png, upsert_fan, maybe_flip_event_to_soldout

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="GOOD MOOD API")
api_router = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


# ---------- Auth utils ----------
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def verify_password(pwd: str, hashed: str) -> bool:
    return bcrypt.checkpw(pwd.encode(), hashed.encode())

def create_token(sub: str, email: str) -> str:
    payload = {"sub": sub, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"email": payload.get("email")})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Not authorized")
        return {"email": user["email"], "role": user["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Catalogue
class VolumeIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    number: str
    title: str
    year: Optional[str] = ""
    plays: Optional[str] = ""
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    listen_url: Optional[str] = ""
    sc_track: Optional[int] = None
    order: int = 0

class Volume(VolumeIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Events (replace TourDate)
EVENT_STATUSES = {"vision", "announced", "on_sale", "sold_out", "past"}

class EventIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    city: str
    country: Optional[str] = ""
    venue: str
    date: str  # ISO
    currency: str = "eur"
    capacity: int = 0
    status: str = "vision"
    ticket_url: Optional[str] = ""  # external fallback for legacy dates without ticket_types

class Event(EventIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TicketTypeIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str
    name: str  # Standard, VIP, Early Bird…
    price_cents: int
    quota: int
    sale_start: Optional[str] = ""
    sale_end: Optional[str] = ""

class TicketType(TicketTypeIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sold: int = 0
    lookup_key: Optional[str] = ""
    stripe_product_id: Optional[str] = ""
    stripe_price_id: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Merch
class ProductIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    price_cents: int
    currency: str = "eur"
    category: Optional[str] = ""
    variant_label: Optional[str] = ""
    variants: List[str] = Field(default_factory=list)
    active: bool = True
    order: int = 0

class Product(ProductIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lookup_key: str = ""
    stripe_product_id: Optional[str] = ""
    stripe_price_id: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class NewsletterIn(BaseModel):
    email: EmailStr
    lang: Optional[str] = "fr"

class NewsletterSubscriber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    lang: str = "fr"
    subscribed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Stripe sync helpers ----------
def _sync_stripe_item(*, id_: str, lookup_prefix: str, name: str, description: str,
                     image_url: str, price_cents: int, currency: str,
                     stripe_product_id: str = "", metadata: Optional[dict] = None) -> dict:
    lookup_key = f"{lookup_prefix}_{id_[:8]}"
    md = {"managed_by": "goodmood", **(metadata or {})}
    kwargs = {"name": name, "description": description or None,
              "images": [image_url] if image_url else None, "metadata": md}
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    if stripe_product_id:
        sp = stripe.Product.modify(stripe_product_id, **kwargs)
    else:
        sp = stripe.Product.create(**kwargs)
    existing = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
    currency = (currency or "eur").lower()
    if existing and (existing[0].unit_amount != int(price_cents) or existing[0].currency != currency):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if existing:
        price_id = existing[0].id
    else:
        p = stripe.Price.create(product=sp.id, unit_amount=int(price_cents), currency=currency,
                                lookup_key=lookup_key, transfer_lookup_key=True)
        price_id = p.id
    return {"lookup_key": lookup_key, "stripe_product_id": sp.id, "stripe_price_id": price_id}


def _sync_product_to_stripe(doc: dict) -> dict:
    res = _sync_stripe_item(id_=doc["id"], lookup_prefix="gm",
        name=doc["name"], description=doc.get("description", ""),
        image_url=doc.get("image_url", ""), price_cents=doc["price_cents"],
        currency=doc.get("currency", "eur"),
        stripe_product_id=doc.get("stripe_product_id", ""),
        metadata={"product_uuid": doc["id"], "type": "merch"})
    doc.update(res)
    return doc


def _sync_ticket_type_to_stripe(tt: dict, ev: dict) -> dict:
    name = f"{ev.get('name') or 'GOOD MOOD LIVE'} · {tt['name']} · {ev.get('city','')}"
    description = f"{ev.get('venue','')} — {(ev.get('date') or '')[:10]}"
    res = _sync_stripe_item(id_=tt["id"], lookup_prefix="gmtt",
        name=name, description=description,
        image_url="", price_cents=tt["price_cents"], currency=ev.get("currency", "eur"),
        stripe_product_id=tt.get("stripe_product_id", ""),
        metadata={"ticket_type_uuid": tt["id"], "event_uuid": ev["id"], "type": "ticket"})
    tt.update(res)
    return tt


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"service": "GOOD MOOD API", "status": "live"}

@api_router.get("/catalogue", response_model=List[Volume])
async def public_catalogue():
    return await db.catalogue.find({}, {"_id": 0}).sort("order", 1).to_list(200)

@api_router.get("/events")
async def public_events():
    # Hide "vision" status from the public. Enrich with ticket_types (public shape).
    events = await db.events.find({"status": {"$ne": "vision"}}, {"_id": 0}).sort("date", 1).to_list(200)
    for ev in events:
        types = await db.ticket_types.find({"event_id": ev["id"]}, {"_id": 0}).sort("price_cents", 1).to_list(50)
        ev["ticket_types"] = [{
            "id": t["id"], "name": t["name"], "price_cents": t["price_cents"],
            "remaining": max(0, (t.get("quota", 0) or 0) - (t.get("sold", 0) or 0)),
            "lookup_key": t.get("lookup_key", ""),
        } for t in types]
    return events

# Legacy alias — frontend Tour.jsx still calls /api/tour during the transition
@api_router.get("/tour")
async def public_tour_alias():
    return await public_events()

@api_router.post("/newsletter")
async def public_newsletter(payload: NewsletterIn):
    email = payload.email.lower()
    existing = await db.newsletter.find_one({"email": email})
    if existing:
        return {"ok": True, "already": True}
    sub = NewsletterSubscriber(email=email, lang=payload.lang or "fr")
    await db.newsletter.insert_one(sub.model_dump())
    try:
        await send_newsletter_welcome(to=email, lang=payload.lang or "fr")
    except Exception as e:
        logging.warning("newsletter welcome email failed: %s", e)
    return {"ok": True, "already": False}

@api_router.get("/merch", response_model=List[Product])
async def public_merch():
    return await db.products.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)


# ---------- Auth ----------
@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(sub=str(user.get("_id")), email=email)
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                       samesite="none", max_age=60*60*12, path="/")
    return {"token": token, "user": {"email": email, "role": user.get("role", "admin")}}

@api_router.get("/auth/me")
async def me(current=Depends(get_current_admin)):
    return current

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Admin: Catalogue ----------
@api_router.get("/admin/catalogue", response_model=List[Volume])
async def admin_catalogue_list(_=Depends(get_current_admin)):
    return await db.catalogue.find({}, {"_id": 0}).sort("order", 1).to_list(500)

@api_router.post("/admin/catalogue", response_model=Volume)
async def admin_catalogue_create(v: VolumeIn, _=Depends(get_current_admin)):
    doc = Volume(**v.model_dump())
    await db.catalogue.insert_one(doc.model_dump())
    return doc

@api_router.put("/admin/catalogue/{vid}", response_model=Volume)
async def admin_catalogue_update(vid: str, v: VolumeIn, _=Depends(get_current_admin)):
    existing = await db.catalogue.find_one({"id": vid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    update = v.model_dump()
    await db.catalogue.update_one({"id": vid}, {"$set": update})
    existing.update(update)
    return existing

@api_router.delete("/admin/catalogue/{vid}")
async def admin_catalogue_delete(vid: str, _=Depends(get_current_admin)):
    res = await db.catalogue.delete_one({"id": vid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Admin: Events + Ticket Types ----------
@api_router.get("/admin/events")
async def admin_events_list(_=Depends(get_current_admin)):
    events = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(500)
    for ev in events:
        types = await db.ticket_types.find({"event_id": ev["id"]}, {"_id": 0}).sort("price_cents", 1).to_list(50)
        ev["ticket_types"] = types
        # aggregates
        ev["total_sold"] = sum((t.get("sold", 0) or 0) for t in types)
        ev["total_quota"] = sum((t.get("quota", 0) or 0) for t in types)
        ev["total_revenue_cents"] = sum((t.get("sold", 0) or 0) * (t.get("price_cents", 0) or 0) for t in types)
    return events

@api_router.post("/admin/events", response_model=Event)
async def admin_events_create(e: EventIn, _=Depends(get_current_admin)):
    if e.status not in EVENT_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {EVENT_STATUSES}")
    doc = Event(**e.model_dump()).model_dump()
    await db.events.insert_one(doc)
    return doc

@api_router.put("/admin/events/{eid}", response_model=Event)
async def admin_events_update(eid: str, e: EventIn, _=Depends(get_current_admin)):
    if e.status not in EVENT_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {EVENT_STATUSES}")
    existing = await db.events.find_one({"id": eid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    update = e.model_dump()
    await db.events.update_one({"id": eid}, {"$set": update})
    existing.update(update)
    return existing

@api_router.delete("/admin/events/{eid}")
async def admin_events_delete(eid: str, _=Depends(get_current_admin)):
    # Delete event + ticket types. Tickets (already-issued) stay for accountability.
    await db.ticket_types.delete_many({"event_id": eid})
    res = await db.events.delete_one({"id": eid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@api_router.post("/admin/events/{eid}/ticket-types", response_model=TicketType)
async def admin_tt_create(eid: str, tt: TicketTypeIn, _=Depends(get_current_admin)):
    ev = await db.events.find_one({"id": eid}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    tt.event_id = eid
    doc = TicketType(**tt.model_dump()).model_dump()
    try:
        _sync_ticket_type_to_stripe(doc, ev)
    except stripe.error.StripeError as ex:
        raise HTTPException(status_code=502, detail=f"Stripe sync failed: {ex.user_message or str(ex)}")
    await db.ticket_types.insert_one(doc)
    return doc

@api_router.put("/admin/events/{eid}/ticket-types/{tid}", response_model=TicketType)
async def admin_tt_update(eid: str, tid: str, tt: TicketTypeIn, _=Depends(get_current_admin)):
    ev = await db.events.find_one({"id": eid}, {"_id": 0})
    existing = await db.ticket_types.find_one({"id": tid, "event_id": eid}, {"_id": 0})
    if not ev or not existing:
        raise HTTPException(status_code=404, detail="Not found")
    existing.update(tt.model_dump())
    existing["event_id"] = eid
    try:
        _sync_ticket_type_to_stripe(existing, ev)
    except stripe.error.StripeError as ex:
        raise HTTPException(status_code=502, detail=f"Stripe sync failed: {ex.user_message or str(ex)}")
    await db.ticket_types.update_one({"id": tid}, {"$set": existing})
    return existing

@api_router.delete("/admin/events/{eid}/ticket-types/{tid}")
async def admin_tt_delete(eid: str, tid: str, _=Depends(get_current_admin)):
    res = await db.ticket_types.delete_one({"id": tid, "event_id": eid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@api_router.get("/admin/events/{eid}/tickets")
async def admin_event_tickets(eid: str, _=Depends(get_current_admin)):
    tickets = await db.tickets.find({"event_id": eid}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"count": len(tickets), "items": tickets}

@api_router.get("/admin/events/{eid}/report")
async def admin_event_report(eid: str, _=Depends(get_current_admin)):
    ev = await db.events.find_one({"id": eid}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    types = await db.ticket_types.find({"event_id": eid}, {"_id": 0}).to_list(100)
    tickets = await db.tickets.find({"event_id": eid}, {"_id": 0}).to_list(5000)
    scanned = sum(1 for t in tickets if t.get("status") == "scanned")
    total_sold = sum((t.get("sold", 0) or 0) for t in types)
    total_quota = sum((t.get("quota", 0) or 0) for t in types) or ev.get("capacity", 0)
    revenue = sum((t.get("sold", 0) or 0) * (t.get("price_cents", 0) or 0) for t in types)
    by_type = [{"name": t["name"], "sold": t.get("sold", 0), "quota": t.get("quota", 0),
                "revenue_cents": (t.get("sold", 0) or 0) * (t.get("price_cents", 0) or 0)} for t in types]
    return {"event": ev, "by_type": by_type,
            "total_sold": total_sold, "total_quota": total_quota,
            "revenue_cents": revenue, "currency": ev.get("currency", "eur"),
            "fill_rate": (total_sold / total_quota) if total_quota else 0.0,
            "checked_in": scanned}


# ---------- Admin: Fans ----------
@api_router.get("/admin/fans")
async def admin_fans_list(_=Depends(get_current_admin)):
    fans = await db.fans.find({}, {"_id": 0}).sort("updated_at", -1).to_list(5000)
    return {"count": len(fans), "items": fans}


# ---------- Admin: Newsletter ----------
@api_router.get("/admin/newsletter")
async def admin_newsletter_list(_=Depends(get_current_admin)):
    items = await db.newsletter.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(5000)
    return {"count": len(items), "items": items}

@api_router.get("/admin/newsletter/export")
async def admin_newsletter_export(_=Depends(get_current_admin)):
    items = await db.newsletter.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(50000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["email", "lang", "subscribed_at"])
    for it in items:
        w.writerow([it.get("email",""), it.get("lang",""), it.get("subscribed_at","")])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=newsletter.csv"})


# ---------- Admin: Merch ----------
@api_router.get("/admin/merch", response_model=List[Product])
async def admin_merch_list(_=Depends(get_current_admin)):
    return await db.products.find({}, {"_id": 0}).sort("order", 1).to_list(500)

@api_router.post("/admin/merch", response_model=Product)
async def admin_merch_create(p: ProductIn, _=Depends(get_current_admin)):
    doc = Product(**p.model_dump()).model_dump()
    try:
        _sync_product_to_stripe(doc)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe sync failed: {e.user_message or str(e)}")
    await db.products.insert_one(doc)
    return doc

@api_router.put("/admin/merch/{pid}", response_model=Product)
async def admin_merch_update(pid: str, p: ProductIn, _=Depends(get_current_admin)):
    existing = await db.products.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    existing.update(p.model_dump())
    try:
        _sync_product_to_stripe(existing)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe sync failed: {e.user_message or str(e)}")
    await db.products.update_one({"id": pid}, {"$set": existing})
    return existing

@api_router.delete("/admin/merch/{pid}")
async def admin_merch_delete(pid: str, _=Depends(get_current_admin)):
    existing = await db.products.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        if existing.get("stripe_product_id"):
            stripe.Product.modify(existing["stripe_product_id"], active=False)
    except stripe.error.StripeError:
        pass
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ---------- Payments / Checkout ----------
class CheckoutRequest(BaseModel):
    lookup_key: str
    quantity: int = Field(1, ge=1, le=10)
    variant: Optional[str] = ""
    origin_url: str
    email: Optional[EmailStr] = None  # required for tickets, optional for merch

@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=404, detail=f"Price not found: {req.lookup_key}")
    price = prices[0]
    is_ticket = req.lookup_key.startswith("gmtt_")
    tt = None
    ev = None
    if is_ticket:
        tt = await db.ticket_types.find_one({"lookup_key": req.lookup_key}, {"_id": 0})
        if not tt:
            raise HTTPException(status_code=404, detail="Ticket type not found")
        ev = await db.events.find_one({"id": tt["event_id"]}, {"_id": 0})
        if not ev or ev.get("status") not in {"on_sale"}:
            raise HTTPException(status_code=400, detail="Event not on sale")
        remaining = max(0, (tt.get("quota", 0) or 0) - (tt.get("sold", 0) or 0))
        if remaining < req.quantity:
            raise HTTPException(status_code=400, detail=f"Only {remaining} left")
        if not req.email:
            raise HTTPException(status_code=422, detail="Email required for ticket purchase")

    metadata = {"lookup_key": req.lookup_key, "variant": req.variant or "",
                "type": "ticket" if is_ticket else "merch"}
    if is_ticket:
        metadata.update({"event_id": tt["event_id"], "ticket_type_id": tt["id"],
                         "buyer_email": req.email})

    session_kwargs = {
        "line_items": [{"price": price.id, "quantity": req.quantity}],
        "mode": "payment",
        "success_url": f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{req.origin_url}/payment/cancel",
        "metadata": metadata,
    }
    if is_ticket and req.email:
        session_kwargs["customer_email"] = req.email
    else:
        session_kwargs["shipping_address_collection"] = {"allowed_countries": [
            "FR","US","GB","DE","ES","IT","BE","NL","CH","PT","CA",
            "MQ","GP","GF","RE","YT","PM","BL","MF","PF","NC"]}
    session = stripe.checkout.Session.create(**session_kwargs)

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "lookup_key": req.lookup_key,
        "variant": req.variant or "",
        "quantity": req.quantity,
        "amount_cents": (price.unit_amount or 0) * req.quantity,
        "currency": price.currency,
        "type": "ticket" if is_ticket else "merch",
        "event_id": (ev or {}).get("id"),
        "ticket_type_id": (tt or {}).get("id"),
        "buyer_email": req.email if is_ticket else None,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_payment_intent_id": s.payment_intent,
                              "customer_email": (s.customer_details or {}).get("email") if s.customer_details else None,
                              "updated_at": datetime.now(timezone.utc).isoformat()}})
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"],
            "amount_cents": record.get("amount_cents"), "currency": record.get("currency"),
            "type": record.get("type"), "ticket_ids": record.get("ticket_ids", [])}


async def _issue_tickets_for_session(session_obj: dict, origin_url: str = "") -> List[str]:
    """Idempotent: creates Ticket docs for a paid ticket session, updates fans, fires FREK-ID + wallet."""
    session_id = session_obj["id"]
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx.get("type") != "ticket":
        return []
    if tx.get("tickets_issued"):
        return tx.get("ticket_ids", [])

    event_id = tx["event_id"]
    tt_id = tx["ticket_type_id"]
    email = (tx.get("buyer_email") or (session_obj.get("customer_details") or {}).get("email") or "").lower()
    name = ((session_obj.get("customer_details") or {}).get("name") or "").strip()
    qty = int(tx.get("quantity") or 1)
    ev = await db.events.find_one({"id": event_id}, {"_id": 0}) or {}
    tt = await db.ticket_types.find_one({"id": tt_id}, {"_id": 0}) or {}

    ticket_ids: List[str] = []
    for _ in range(qty):
        tid = str(uuid.uuid4())
        ticket_ids.append(tid)
        await db.tickets.insert_one({
            "id": tid, "event_id": event_id, "ticket_type_id": tt_id,
            "ticket_type_name": tt.get("name", ""),
            "event_name": ev.get("name", ""), "event_date": ev.get("date", ""),
            "city": ev.get("city", ""), "venue": ev.get("venue", ""),
            "buyer_email": email, "buyer_name": name,
            "session_id": session_id,
            "status": "valid",
            "scanned_at": None, "scanned_by": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    # Atomic increment
    await db.ticket_types.update_one({"id": tt_id}, {"$inc": {"sold": qty}})
    await db.payment_transactions.update_one({"session_id": session_id},
        {"$set": {"tickets_issued": True, "ticket_ids": ticket_ids}})

    # Fan upsert
    await upsert_fan(db, email=email, name=name, event_id=event_id,
                    event_name=ev.get("name",""), event_date=ev.get("date",""),
                    city=ev.get("city",""), ticket_type=tt.get("name",""))

    # FREK-ID synchronous emit (queue on fail)
    try:
        await frek_service.emit(db, interaction_type="purchase",
            email=email, external_id=f"gm-fan-{email.split('@')[0] if '@' in email else email}",
            event_id=event_id, event_name=ev.get("name",""), city=ev.get("city",""),
            event_date=ev.get("date",""), ticket_type=tt.get("name",""))
    except Exception as e:
        logging.warning("frek_id emit error: %s", e)

    # Wallet push for each ticket (queue on fail)
    base = origin_url or os.environ.get("PUBLIC_BASE_URL", "")
    for tid in ticket_ids:
        try:
            await wallet_service.push_ticket(db, ticket_id=tid, email=email,
                event_id=event_id, event_name=ev.get("name",""), city=ev.get("city",""),
                venue=ev.get("venue",""), event_date=ev.get("date",""),
                ticket_type=tt.get("name",""),
                qr_url=f"{base}/api/tickets/{tid}/qr.png",
                view_url=f"{base}/ticket/{tid}")
        except Exception as e:
            logging.warning("wallet push error: %s", e)

    # Ticket confirmation email
    try:
        await send_ticket_confirmation(to=email, event_name=ev.get("name",""),
            event_date=ev.get("date",""), venue=ev.get("venue",""), city=ev.get("city",""),
            ticket_type=tt.get("name",""), quantity=qty,
            amount_cents=int(tx.get("amount_cents") or 0),
            currency=tx.get("currency","eur"),
            first_ticket_url=f"{base}/ticket/{ticket_ids[0]}",
            qr_url=f"{base}/api/tickets/{ticket_ids[0]}/qr.png")
    except Exception as e:
        logging.warning("ticket email error: %s", e)

    # Maybe flip event to sold_out
    await maybe_flip_event_to_soldout(db, event_id)

    return ticket_ids


# ---------- Stripe webhook ----------
@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "stripe_payment_intent_id": obj.get("payment_intent"),
                      "customer_email": (obj.get("customer_details") or {}).get("email"),
                      "updated_at": datetime.now(timezone.utc).isoformat()}})
        tx = await db.payment_transactions.find_one({"session_id": obj["id"]}, {"_id": 0})
        if tx and tx.get("type") == "ticket":
            await _issue_tickets_for_session(obj, origin_url=os.environ.get("PUBLIC_BASE_URL",""))
        else:
            # merch order confirmation
            email_to = (obj.get("customer_details") or {}).get("email")
            if tx and email_to:
                try:
                    product = await db.products.find_one({"lookup_key": tx.get("lookup_key")}, {"_id": 0})
                    await send_order_confirmation(to=email_to,
                        product_name=(product or {}).get("name") or tx.get("lookup_key") or "Good Mood item",
                        size=tx.get("variant") or "", quantity=int(tx.get("quantity") or 1),
                        amount_cents=int(tx.get("amount_cents") or 0),
                        currency=tx.get("currency") or "eur")
                except Exception as e:
                    logging.warning("order confirmation email failed: %s", e)
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed",
                      "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "ok"}


# ---------- Tickets (public view + QR) ----------
@api_router.get("/tickets/{tid}")
async def public_ticket(tid: str):
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ev = await db.events.find_one({"id": t["event_id"]}, {"_id": 0}) or {}
    return {"ticket": t, "event": {"name": ev.get("name",""), "date": ev.get("date",""),
        "venue": ev.get("venue",""), "city": ev.get("city",""), "country": ev.get("country","")}}

@api_router.get("/tickets/{tid}/qr.png")
async def public_ticket_qr(tid: str):
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    png = generate_qr_png(tid)
    return FastResponse(content=png, media_type="image/png",
                       headers={"Cache-Control": "public, max-age=3600"})


# ---------- Scan (staff — admin JWT required) ----------
class ScanRequest(BaseModel):
    ticket_id: str
    event_id: Optional[str] = None  # optional guard: reject if scanning wrong event

@api_router.post("/scan/check")
async def scan_check(req: ScanRequest, admin=Depends(get_current_admin)):
    t = await db.tickets.find_one({"id": req.ticket_id}, {"_id": 0})
    if not t:
        return {"result": "invalid", "reason": "Ticket not found"}
    if req.event_id and t["event_id"] != req.event_id:
        return {"result": "invalid", "reason": "Wrong event", "ticket": t}
    if t.get("status") == "scanned":
        return {"result": "already_scanned", "ticket": t}
    # Mark scanned
    now = datetime.now(timezone.utc).isoformat()
    await db.tickets.update_one({"id": req.ticket_id},
        {"$set": {"status": "scanned", "scanned_at": now, "scanned_by": admin["email"]}})
    t["status"] = "scanned"; t["scanned_at"] = now; t["scanned_by"] = admin["email"]

    # FREK-ID emit for entry_scan
    ev = await db.events.find_one({"id": t["event_id"]}, {"_id": 0}) or {}
    try:
        await frek_service.emit(db, interaction_type="entry_scan",
            email=t.get("buyer_email",""),
            external_id=f"gm-fan-{(t.get('buyer_email','') or '').split('@')[0]}",
            event_id=t["event_id"], event_name=ev.get("name",""),
            city=ev.get("city",""), event_date=ev.get("date",""),
            ticket_type=t.get("ticket_type_name",""))
    except Exception as e:
        logging.warning("frek_id scan emit error: %s", e)

    return {"result": "valid", "ticket": t}

@api_router.get("/scan/counter/{eid}")
async def scan_counter(eid: str, _=Depends(get_current_admin)):
    total_scanned = await db.tickets.count_documents({"event_id": eid, "status": "scanned"})
    total_valid = await db.tickets.count_documents({"event_id": eid, "status": {"$in": ["valid","scanned"]}})
    ev = await db.events.find_one({"id": eid}, {"_id": 0}) or {}
    return {"event_id": eid, "capacity": ev.get("capacity", 0),
            "scanned": total_scanned, "issued": total_valid}


# ---------- Admin Orders / Outboxes / Payments ----------
@api_router.get("/admin/orders")
async def admin_orders(_=Depends(get_current_admin)):
    items = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"count": len(items), "items": items}

@api_router.get("/admin/outbox/frek-id")
async def admin_frek_outbox(_=Depends(get_current_admin)):
    items = await db.frek_id_outbox.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"count": len(items), "items": items,
            "configured_url": (os.environ.get("FREK_ID_URL") or "").rstrip("/") or None}

@api_router.get("/admin/outbox/wallet")
async def admin_wallet_outbox(_=Depends(get_current_admin)):
    items = await db.wallet_outbox.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"count": len(items), "items": items,
            "configured_url": (os.environ.get("WALLET_URL") or "").rstrip("/") or None}


# ---------- Startup ----------
DEFAULT_VOLUMES = [
    {"number":"01","title":"GOOD MOOD","year":"2017","plays":"","description":"The origin. Where Good Mood begins.","cover_url":"https://i1.sndcdn.com/artworks-000225635084-6zerwt-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/good-mood-dj-sayd-gm-2017","sc_track":None,"order":1},
    {"number":"02","title":"GOOD MOOD VOL. 2","year":"2018","plays":"16.7K","description":"#GM2 — @DjSayd.","cover_url":"https://i1.sndcdn.com/artworks-TKmcgLpmn0HWRN0P-nEhfCg-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/good-mood-vol2-djsayd-gm2","sc_track":None,"order":2},
    {"number":"03","title":"NWARLAND PARTY","year":"2018","plays":"40.2K","description":"Good Mood Vol. 3 — Nwarland Party.","cover_url":"https://i1.sndcdn.com/artworks-000405327897-w1spib-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol-3-nwarland-party-2018-master","sc_track":None,"order":3},
    {"number":"04","title":"REMEMBER","year":"2020","plays":"7 157","description":"Good Mood Vol. 4 — Remember.","cover_url":"https://i1.sndcdn.com/artworks-000677300032-mc0h5u-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol-4-remember","sc_track":None,"order":4},
    {"number":"05","title":"NWARLAND PT.2","year":"2020","plays":"73.6K","description":"Good Mood Vol. 5 — Nwarland Pt. 2.","cover_url":"https://i1.sndcdn.com/artworks-9yPauXMVGDZvQlCA-aQ9EBw-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol5-nwarland-pt2-2020","sc_track":None,"order":5},
    {"number":"06","title":"VIE DE CÉSAR","year":"2021","plays":"200K","description":"Good Mood Vol. 6 — Vie de César.","cover_url":"https://i1.sndcdn.com/artworks-FZHEwf3V3EQIsksY-aLUXbQ-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol6-vie-de-cesar-2021","sc_track":None,"order":6},
    {"number":"07","title":"GOOD MOOD VOL. 7","year":"2022","plays":"102K","description":"Good Mood Vol. 7.","cover_url":"https://i1.sndcdn.com/artworks-k6HKcPpFlMr8qeRu-0PmtqQ-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol7-2021","sc_track":None,"order":7},
    {"number":"08","title":"LIVE BIRTHDAY","year":"2022","plays":"530K","description":"Good Mood Vol. 8 — feat. DJ VYBZ. Live Birthday.","cover_url":"https://i1.sndcdn.com/artworks-FFfUuX9zUom4JypX-GnS6zg-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-8-feat-dj-vybz-edition-live-birthday","sc_track":None,"order":8},
    {"number":"09","title":"SUMMER BABY","year":"2022","plays":"83K","description":"Good Mood Vol. 9 — Summer Baby.","cover_url":"https://i1.sndcdn.com/artworks-tG8iWNKSidxh7sCy-yETZyA-t500x500.jpg","listen_url":"https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol9-summer-baby-2022","sc_track":None,"order":9},
]


@app.on_event("startup")
async def startup():
    # Admin seed
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@goodmood.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "GoodMood2026")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email,
            "password_hash": hash_password(admin_password), "role": "admin",
            "name": "Good Mood Admin",
            "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}})

    # Catalogue seed / migration
    if await db.catalogue.count_documents({}) == 0:
        for v in DEFAULT_VOLUMES:
            await db.catalogue.insert_one(Volume(**v).model_dump())
    else:
        LEGACY_TITLES = {"GENESIS","NOCTURNE","TROPIC HEAT","VOID PARADE","AMBER CITY","NEBULA","SIGNAL","EQUINOX","APEX"}
        PLAYLIST_URL = "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd"
        for v in DEFAULT_VOLUMES:
            await db.catalogue.update_one(
                {"number": v["number"], "$or": [{"cover_url": ""}, {"cover_url": {"$exists": False}}]},
                {"$set": {"cover_url": v.get("cover_url","")}})
            await db.catalogue.update_one(
                {"number": v["number"], "$or": [
                    {"title": {"$in": list(LEGACY_TITLES)}}, {"listen_url": PLAYLIST_URL}]},
                {"$set": {"title": v["title"], "year": v.get("year",""),
                          "plays": v.get("plays",""), "description": v.get("description",""),
                          "cover_url": v.get("cover_url",""), "listen_url": v.get("listen_url",""),
                          "sc_track": v.get("sc_track"), "order": v["order"]}})

    # ONE-TIME MIGRATION: tour → events (if events collection is empty and tour has legacy docs)
    if await db.events.count_documents({}) == 0 and await db.tour.count_documents({}) > 0:
        async for t in db.tour.find({}, {"_id": 0}):
            new_ev = {
                "id": t.get("id") or str(uuid.uuid4()),
                "name": f"GOOD MOOD LIVE · {t.get('city','')}",
                "city": t.get("city",""), "venue": t.get("venue",""),
                "country": t.get("country",""), "date": t.get("date",""),
                "currency": t.get("currency","eur"), "capacity": 0,
                "status": "sold_out" if t.get("status") == "soldout" else "announced",
                "ticket_url": t.get("ticket_url",""),
                "created_at": t.get("created_at") or datetime.now(timezone.utc).isoformat(),
            }
            await db.events.insert_one(new_ev)

    # Indexes
    await db.newsletter.create_index("email", unique=True)
    await db.users.create_index("email", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.events.create_index("date")
    await db.tickets.create_index("id", unique=True)
    await db.tickets.create_index("event_id")
    await db.ticket_types.create_index("event_id")
    await db.ticket_types.create_index("lookup_key", unique=True, sparse=True)
    await db.fans.create_index("email", unique=True)
    await db.frek_id_outbox.create_index([("status", 1), ("next_attempt_at", 1)])
    await db.wallet_outbox.create_index([("status", 1), ("next_attempt_at", 1)])

    # Launch retry loops
    asyncio.create_task(frek_service.retry_loop(db))
    asyncio.create_task(wallet_service.retry_loop(db))


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown():
    client.close()
