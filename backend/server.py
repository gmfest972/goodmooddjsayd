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
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional


# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="GOOD MOOD API")
api_router = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']


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


# ---------- Startup ----------
DEFAULT_VOLUMES = [
    {"number": "01", "title": "GOOD MOOD",          "year": "2017", "plays": "",       "description": "The origin. Where Good Mood begins.",         "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 0, "order": 1},
    {"number": "02", "title": "GOOD MOOD VOL. 2",   "year": "2018", "plays": "16.7K",  "description": "#GM2 — @DjSayd.",                              "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 1, "order": 2},
    {"number": "03", "title": "NWARLAND PARTY",     "year": "2018", "plays": "40.2K",  "description": "Good Mood Vol. 3 — Nwarland Party.",          "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 2, "order": 3},
    {"number": "04", "title": "REMEMBER",           "year": "2020", "plays": "7 157",  "description": "Good Mood Vol. 4 — Remember.",                "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 3, "order": 4},
    {"number": "05", "title": "NWARLAND PT.2",      "year": "2020", "plays": "73.6K",  "description": "Good Mood Vol. 5 — Nwarland Pt. 2.",          "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 4, "order": 5},
    {"number": "06", "title": "VIE DE CÉSAR",       "year": "2021", "plays": "200K",   "description": "Good Mood Vol. 6 — Vie de César.",            "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 5, "order": 6},
    {"number": "07", "title": "GOOD MOOD VOL. 7",   "year": "2022", "plays": "102K",   "description": "Good Mood Vol. 7.",                           "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 6, "order": 7},
    {"number": "08", "title": "LIVE BIRTHDAY",      "year": "2022", "plays": "530K",   "description": "Good Mood Vol. 8 — feat. DJ VYBZ. Live Birthday.", "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 7, "order": 8},
    {"number": "09", "title": "SUMMER BABY",        "year": "2022", "plays": "83K",    "description": "Good Mood Vol. 9 — Summer Baby.",             "listen_url": "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd", "sc_track": 8, "order": 9},
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
        # One-time migration: only update docs still holding legacy demo titles.
        # Never touches admin-edited records.
        LEGACY_TITLES = {"GENESIS", "NOCTURNE", "TROPIC HEAT", "VOID PARADE",
                         "AMBER CITY", "NEBULA", "SIGNAL", "EQUINOX", "APEX"}
        for v in DEFAULT_VOLUMES:
            await db.catalogue.update_one(
                {"number": v["number"], "title": {"$in": list(LEGACY_TITLES)}},
                {"$set": {
                    "title": v["title"],
                    "year": v.get("year", ""),
                    "plays": v.get("plays", ""),
                    "description": v.get("description", ""),
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

    # Indexes
    await db.newsletter.create_index("email", unique=True)
    await db.users.create_index("email", unique=True)


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
