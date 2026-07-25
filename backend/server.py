from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
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
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from email_service import send_newsletter_welcome, send_order_confirmation


# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="GOOD MOOD API")
api_router = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

# Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


# ---------- Utilities ----------
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def verify_password(pwd: str, hashed: str) -> bool:
    return bcrypt.checkpw(pwd.encode(), hashed.encode())

def create_token(sub: str, email: str) -> str:
    payload = {
        "sub": sub, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
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

class VolumeIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    number: str = Field(..., description="Volume number, e.g. '01'")
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

class TourDateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    city: str
    venue: str
    country: Optional[str] = ""
    date: str  # ISO string
    ticket_url: Optional[str] = ""
    status: Optional[str] = "available"  # available | soldout

class TourDate(TourDateIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class NewsletterIn(BaseModel):
    email: EmailStr
    lang: Optional[str] = "fr"

class NewsletterSubscriber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    lang: str = "fr"
    subscribed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"service": "GOOD MOOD API", "status": "live"}

@api_router.get("/catalogue", response_model=List[Volume])
async def public_catalogue():
    items = await db.catalogue.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return items

@api_router.get("/tour", response_model=List[TourDate])
async def public_tour():
    items = await db.tour.find({}, {"_id": 0}).sort("date", 1).to_list(200)
    return items

@api_router.post("/newsletter")
async def public_newsletter(payload: NewsletterIn):
    email = payload.email.lower()
    existing = await db.newsletter.find_one({"email": email})
    if existing:
        return {"ok": True, "already": True}
    sub = NewsletterSubscriber(email=email, lang=payload.lang or "fr")
    await db.newsletter.insert_one(sub.model_dump())
    # Fire welcome email (no-op if RESEND_API_KEY not set)
    try:
        await send_newsletter_welcome(to=email, lang=payload.lang or "fr")
    except Exception as e:  # noqa: BLE001
        logging.warning("newsletter welcome email failed: %s", e)
    return {"ok": True, "already": False}


# ---------- Auth ----------
@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(sub=str(user.get("_id")), email=email)
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=60 * 60 * 12, path="/"
    )
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
    items = await db.catalogue.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return items

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


# ---------- Admin: Tour ----------
@api_router.get("/admin/tour", response_model=List[TourDate])
async def admin_tour_list(_=Depends(get_current_admin)):
    items = await db.tour.find({}, {"_id": 0}).sort("date", 1).to_list(500)
    return items

@api_router.post("/admin/tour", response_model=TourDate)
async def admin_tour_create(t: TourDateIn, _=Depends(get_current_admin)):
    doc = TourDate(**t.model_dump())
    await db.tour.insert_one(doc.model_dump())
    return doc

@api_router.put("/admin/tour/{tid}", response_model=TourDate)
async def admin_tour_update(tid: str, t: TourDateIn, _=Depends(get_current_admin)):
    existing = await db.tour.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    update = t.model_dump()
    await db.tour.update_one({"id": tid}, {"$set": update})
    existing.update(update)
    return existing

@api_router.delete("/admin/tour/{tid}")
async def admin_tour_delete(tid: str, _=Depends(get_current_admin)):
    res = await db.tour.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Admin: Newsletter ----------
@api_router.get("/admin/newsletter")
async def admin_newsletter_list(_=Depends(get_current_admin)):
    items = await db.newsletter.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(5000)
    return {"count": len(items), "items": items}

@api_router.get("/admin/newsletter/export")
async def admin_newsletter_export(_=Depends(get_current_admin)):
    items = await db.newsletter.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(50000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["email", "lang", "subscribed_at"])
    for it in items:
        writer.writerow([it.get("email", ""), it.get("lang", ""), it.get("subscribed_at", "")])
    csv_bytes = buf.getvalue()
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=newsletter.csv"},
    )


# ---------- Merch / Products ----------
class ProductIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    price_cents: int  # cents in `currency`
    currency: str = "eur"
    category: Optional[str] = ""  # free-text: "Apparel", "Vinyl", "Print", "Ticket", "Digital", ...
    variant_label: Optional[str] = ""  # e.g. "SIZE", "FORMAT", "COLOR", "EDITION", ""
    variants: List[str] = Field(default_factory=list)
    active: bool = True
    order: int = 0

class Product(ProductIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lookup_key: str = ""
    stripe_product_id: Optional[str] = ""
    stripe_price_id: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _sync_product_to_stripe(doc: dict) -> dict:
    """Create or update the Stripe product + price for a merch item.
    Idempotent by lookup_key. Deactivates the old price if amount/currency changed.
    """
    lookup_key = doc.get("lookup_key") or f"gm_{doc['id'][:8]}"
    doc["lookup_key"] = lookup_key

    # Product
    stripe_product_id = doc.get("stripe_product_id")
    product_kwargs = {
        "name": doc["name"],
        "description": doc.get("description") or None,
        "images": [doc["image_url"]] if doc.get("image_url") else None,
        "active": bool(doc.get("active", True)),
        "metadata": {"managed_by": "goodmood", "product_uuid": doc["id"]},
    }
    product_kwargs = {k: v for k, v in product_kwargs.items() if v is not None}
    if stripe_product_id:
        sp = stripe.Product.modify(stripe_product_id, **product_kwargs)
    else:
        sp = stripe.Product.create(**product_kwargs)
        doc["stripe_product_id"] = sp.id

    # Price — find by lookup_key, deactivate if amount/currency changed
    existing = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
    price_cents = int(doc["price_cents"])
    currency = doc.get("currency", "eur").lower()
    if existing and (existing[0].unit_amount != price_cents or existing[0].currency != currency):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if existing:
        doc["stripe_price_id"] = existing[0].id
    else:
        p = stripe.Price.create(
            product=sp.id,
            unit_amount=price_cents,
            currency=currency,
            lookup_key=lookup_key,
            transfer_lookup_key=True,
        )
        doc["stripe_price_id"] = p.id
    return doc


@api_router.get("/merch", response_model=List[Product])
async def public_merch():
    items = await db.products.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(200)
    return items


@api_router.get("/admin/merch", response_model=List[Product])
async def admin_merch_list(_=Depends(get_current_admin)):
    items = await db.products.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return items


@api_router.post("/admin/merch", response_model=Product)
async def admin_merch_create(p: ProductIn, _=Depends(get_current_admin)):
    doc = Product(**p.model_dump()).model_dump()
    try:
        doc = _sync_product_to_stripe(doc)
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
        existing = _sync_product_to_stripe(existing)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe sync failed: {e.user_message or str(e)}")
    await db.products.update_one({"id": pid}, {"$set": existing})
    return existing


@api_router.delete("/admin/merch/{pid}")
async def admin_merch_delete(pid: str, _=Depends(get_current_admin)):
    existing = await db.products.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    # Deactivate in Stripe (don't delete — historical orders reference it)
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


@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    prices = stripe.Price.list(lookup_keys=[req.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=404, detail=f"Price not found: {req.lookup_key}")
    price = prices[0]
    session = stripe.checkout.Session.create(
        line_items=[{"price": price.id, "quantity": req.quantity}],
        mode="payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        shipping_address_collection={"allowed_countries": [
            "FR", "US", "GB", "DE", "ES", "IT", "BE", "NL", "CH", "PT", "CA",
            "MQ", "GP", "GF", "RE", "YT", "PM", "BL", "MF", "PF", "NC"
        ]},
        metadata={"lookup_key": req.lookup_key, "variant": req.variant or ""},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "lookup_key": req.lookup_key,
        "variant": req.variant or "",
        "quantity": req.quantity,
        "amount_cents": (price.unit_amount or 0) * req.quantity,
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # Webhook fallback — Stripe direct check while still pending
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "status": "completed",
                        "payment_status": "paid",
                        "stripe_payment_intent_id": s.payment_intent,
                        "customer_email": (s.customer_details or {}).get("email") if s.customer_details else None,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
        "amount_cents": record.get("amount_cents"),
        "currency": record.get("currency"),
    }


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
            {"$set": {
                "status": "completed",
                "payment_status": obj.get("payment_status", "paid"),
                "stripe_payment_intent_id": obj.get("payment_intent"),
                "customer_email": (obj.get("customer_details") or {}).get("email"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        # Order confirmation email (no-op if RESEND_API_KEY not set)
        try:
            tx = await db.payment_transactions.find_one({"session_id": obj["id"]}, {"_id": 0})
            email_to = (obj.get("customer_details") or {}).get("email")
            if tx and email_to:
                product = await db.products.find_one({"lookup_key": tx.get("lookup_key")}, {"_id": 0})
                await send_order_confirmation(
                    to=email_to,
                    product_name=(product or {}).get("name") or tx.get("lookup_key") or "Good Mood item",
                    size=tx.get("variant") or tx.get("size") or "",
                    quantity=int(tx.get("quantity") or 1),
                    amount_cents=int(tx.get("amount_cents") or 0),
                    currency=tx.get("currency") or "eur",
                )
        except Exception as e:  # noqa: BLE001
            logging.warning("order confirmation email failed: %s", e)
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed",
                      "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"status": "ok"}


@api_router.get("/admin/orders")
async def admin_orders(_=Depends(get_current_admin)):
    items = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"count": len(items), "items": items}


# ---------- Startup ----------
DEFAULT_VOLUMES = [
    {"number": "01", "title": "GOOD MOOD",          "year": "2017", "plays": "",       "description": "The origin. Where Good Mood begins.",              "cover_url": "https://i1.sndcdn.com/artworks-000225635084-6zerwt-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/good-mood-dj-sayd-gm-2017",                              "sc_track": None, "order": 1},
    {"number": "02", "title": "GOOD MOOD VOL. 2",   "year": "2018", "plays": "16.7K",  "description": "#GM2 — @DjSayd.",                                  "cover_url": "https://i1.sndcdn.com/artworks-TKmcgLpmn0HWRN0P-nEhfCg-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/good-mood-vol2-djsayd-gm2",                              "sc_track": None, "order": 2},
    {"number": "03", "title": "NWARLAND PARTY",     "year": "2018", "plays": "40.2K",  "description": "Good Mood Vol. 3 — Nwarland Party.",               "cover_url": "https://i1.sndcdn.com/artworks-000405327897-w1spib-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol-3-nwarland-party-2018-master",     "sc_track": None, "order": 3},
    {"number": "04", "title": "REMEMBER",           "year": "2020", "plays": "7 157",  "description": "Good Mood Vol. 4 — Remember.",                     "cover_url": "https://i1.sndcdn.com/artworks-000677300032-mc0h5u-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol-4-remember",                       "sc_track": None, "order": 4},
    {"number": "05", "title": "NWARLAND PT.2",      "year": "2020", "plays": "73.6K",  "description": "Good Mood Vol. 5 — Nwarland Pt. 2.",               "cover_url": "https://i1.sndcdn.com/artworks-9yPauXMVGDZvQlCA-aQ9EBw-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol5-nwarland-pt2-2020",               "sc_track": None, "order": 5},
    {"number": "06", "title": "VIE DE CÉSAR",       "year": "2021", "plays": "200K",   "description": "Good Mood Vol. 6 — Vie de César.",                 "cover_url": "https://i1.sndcdn.com/artworks-FZHEwf3V3EQIsksY-aLUXbQ-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol6-vie-de-cesar-2021",               "sc_track": None, "order": 6},
    {"number": "07", "title": "GOOD MOOD VOL. 7",   "year": "2022", "plays": "102K",   "description": "Good Mood Vol. 7.",                                "cover_url": "https://i1.sndcdn.com/artworks-k6HKcPpFlMr8qeRu-0PmtqQ-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol7-2021",                            "sc_track": None, "order": 7},
    {"number": "08", "title": "LIVE BIRTHDAY",      "year": "2022", "plays": "530K",   "description": "Good Mood Vol. 8 — feat. DJ VYBZ. Live Birthday.", "cover_url": "https://i1.sndcdn.com/artworks-FFfUuX9zUom4JypX-GnS6zg-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-8-feat-dj-vybz-edition-live-birthday", "sc_track": None, "order": 8},
    {"number": "09", "title": "SUMMER BABY",        "year": "2022", "plays": "83K",    "description": "Good Mood Vol. 9 — Summer Baby.",                  "cover_url": "https://i1.sndcdn.com/artworks-tG8iWNKSidxh7sCy-yETZyA-t500x500.jpg", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/dj-sayd-good-mood-vol9-summer-baby-2022",                "sc_track": None, "order": 9},
]

DEFAULT_TOUR = [
    {"city": "Paris", "country": "France", "venue": "La Machine du Moulin Rouge", "date": "2026-04-18T22:00:00Z", "ticket_url": "#", "status": "available"},
    {"city": "Fort-de-France", "country": "Martinique", "venue": "Zenith Sud", "date": "2026-05-09T21:00:00Z", "ticket_url": "#", "status": "available"},
    {"city": "Pointe-à-Pitre", "country": "Guadeloupe", "venue": "Le Riviera", "date": "2026-05-16T21:00:00Z", "ticket_url": "#", "status": "available"},
    {"city": "Miami", "country": "USA", "venue": "Club Space", "date": "2026-06-12T23:00:00Z", "ticket_url": "#", "status": "available"},
    {"city": "London", "country": "UK", "venue": "Printworks", "date": "2026-07-05T22:00:00Z", "ticket_url": "#", "status": "available"},
]


@app.on_event("startup")
async def startup():
    # Seed admin (idempotent)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@goodmood.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "GoodMood2026")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "name": "Good Mood Admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.info("Seeded admin user: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logging.info("Updated admin password for: %s", admin_email)

    # Seed catalogue (only if empty)
    if await db.catalogue.count_documents({}) == 0:
        for v in DEFAULT_VOLUMES:
            doc = Volume(**v).model_dump()
            await db.catalogue.insert_one(doc)
        logging.info("Seeded 9 catalogue volumes")
    else:
        # One-time migration: only update docs still holding legacy demo titles OR
        # docs still pointing at the shared playlist URL (i.e. seeded, non-admin-edited).
        # Never touches admin-edited records (title != legacy AND listen_url != playlist).
        LEGACY_TITLES = {"GENESIS", "NOCTURNE", "TROPIC HEAT", "VOID PARADE",
                         "AMBER CITY", "NEBULA", "SIGNAL", "EQUINOX", "APEX"}
        PLAYLIST_URL = "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd"
        for v in DEFAULT_VOLUMES:
            # Backfill cover_url for docs that don't have one yet (independent of the
            # legacy/playlist gate below, so admin-edited docs also get covers if missing).
            await db.catalogue.update_one(
                {"number": v["number"], "$or": [{"cover_url": ""}, {"cover_url": {"$exists": False}}]},
                {"$set": {"cover_url": v.get("cover_url", "")}}
            )
            # Full seed refresh only for still-seeded (non-admin-edited) docs
            await db.catalogue.update_one(
                {"number": v["number"], "$or": [
                    {"title": {"$in": list(LEGACY_TITLES)}},
                    {"listen_url": PLAYLIST_URL},
                ]},
                {"$set": {
                    "title": v["title"],
                    "year": v.get("year", ""),
                    "plays": v.get("plays", ""),
                    "description": v.get("description", ""),
                    "cover_url": v.get("cover_url", ""),
                    "listen_url": v.get("listen_url", ""),
                    "sc_track": v.get("sc_track"),
                    "order": v["order"],
                }}
            )

    # Seed tour dates (only if empty)
    if await db.tour.count_documents({}) == 0:
        for t in DEFAULT_TOUR:
            doc = TourDate(**t).model_dump()
            await db.tour.insert_one(doc)
        logging.info("Seeded default tour dates")

    # Merch: NO seed by default — admin adds real products via CRM

    # Indexes
    await db.newsletter.create_index("email", unique=True)
    await db.users.create_index("email", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown():
    client.close()
