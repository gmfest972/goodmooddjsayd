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
- Hero 3D **global fixed background** (React Three Fiber particles)
- Catalogue (9 REAL volumes with SoundCloud covers + individual track URLs) + SC widget modal
- **Events (ex-Tour)** with 5 statuses (vision/announced/on_sale/sold_out/past) + ticket types with Stripe sync
- **Ticketing internal** : Stripe Checkout → QR code auto-généré → email confirmation (Resend live) → billet accessible sur `/ticket/{id}`
- **Scan door `/scan`** : caméra html5-qrcode, statuts valid/already_scanned/invalid, compteur live
- **Fan CRM** : auto-créé à l'achat, segments primo/recurring/vip, table admin
- **FREK-ID outbox** : call synchrone + retry queue (backoffs 30s/2m/10m/1h/6h), pointé sur mock — flip env var quand FrekCore up
- **CVLN Wallet outbox** : même pattern que FREK-ID
- Store / Merch — Stripe Checkout, produits génériques (category + variant_label + variants libres)
- Newsletter → MongoDB + Resend welcome email
- Language switcher (FR / EN / ES / Kreyòl)
- Admin CRM 6 onglets : Catalogue, Events (+ ticket types nested), Fans, Store, Orders, Newsletter
- Brand identity : GM logo (nav + footer), socials 5 liens (2 IG + FMS + VEVO + SC)
- Zéro trace visible d'Emergent

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
