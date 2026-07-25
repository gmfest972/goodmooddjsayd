# GOOD MOOD — PRD

## Original Problem Statement
Build a website + admin CRM for "GOOD MOOD" — a standalone brand (spinoff of DJ SAYD mixes) under CVLN Groupe Holding's Events division. 6 modules: Catalogue, Events (Tour/Fest), Media, Merch, Billetterie, Store. Multilingual: FR / EN / ES / Kreyòl. Data doctrine: local capture (Good Mood CRM) + FREK-ID uplink (deferred).

## User Personas
- **Sayd (owner/admin)** — needs a CRM to manage catalogue, tour dates, and see newsletter signups
- **Public visitor / fan** — discovers volumes, listens on SoundCloud, checks tour dates, subscribes to newsletter
- **Sponsors / partners** (Phase 2) — sees sponsors module, media reel, event proof

## Architecture
- **Front-office** (`/`): Hero 3D + Catalogue + Tour + Newsletter, single-page bento
- **Back-office** (`/admin`, `/admin/login`): JWT-auth admin CRM
- **Stack**: FastAPI + MongoDB + React + Three.js + i18next
- **Integrations**: SoundCloud HTML5 Widget (catalogue playback)

## Phase 1 — DONE (2026-07-22 → 2026-07-25)
- Hero 3D **global fixed background** (React Three Fiber particles) — stays immobile while all sections scroll over it
- Marquee cities strip
- Catalogue (9 REAL volumes with SoundCloud covers + individual track URLs) + inline SoundCloud player modal
- Tour (5 seeded dates)
- **Store / Merch — Stripe Checkout live** — no more demo tee, admin adds real products via CRM. Sizes optional (auto-hide selector if empty)
- Newsletter capture → MongoDB
- **Resend email scaffold** — welcome email on newsletter signup + order confirmation email on Stripe payment. Currently no-op (RESEND_API_KEY empty). Drop key + restart → emails fire.
- Language switcher (FR / EN / ES / Kreyòl)
- Admin CRM: JWT login, CRUD Catalogue + Tour + Store (Stripe sync auto) + Orders viewer + Newsletter CSV export
- Brand identity: GM logo (nav + footer), socials (2 IG, VEVO, SoundCloud)
- Payment infra: Stripe sandbox (claimable), webhook `/api/stripe/webhook`, idempotent payment_transactions

## Phase 2 — BACKLOG (P0/P1/P2)
### P0 (business-critical)
- **Resend email**: newsletter confirmation + broadcast (waiting on API key from user)
- **Multi-language content**: allow admin to enter FR/EN/ES/KR versions per volume & tour date
- **Real catalogue data**: user to populate 9 real titles + covers + SoundCloud URLs via admin

### P1 (module expansion — from socle)
- **Media Center**: video reel, IG feed, curated moments
- **Store / Merch**: e-commerce line (Stripe, Shopify or custom)
- **Billetterie**: ticketing integration (Weezevent / Shotgun API, or custom)
- **Sponsors module**: public partners section + admin pipeline
- **JTV Digital distribution activation** (multi-DSP: Spotify, Apple, Deezer, YT Music)

### P2 (advanced)
- **FREK-ID uplink**: technical integration point per data doctrine
- **Good Mood OS full back-office**: Sponsoring, Finance, Media scheduling, IP registry
- **Fan segmentation & campaigns** in CRM
- **Documentary series capture module**
- **IP registration workflow** (name, formats)

## Test Credentials
See `/app/memory/test_credentials.md`

## Deferred / Blocked
- Resend API key not yet provided
- FMS label branding integration
- JTV Digital activation (external partner conversation)
