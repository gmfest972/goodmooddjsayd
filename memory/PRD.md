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

## Phase 1 — DONE (2026-07-22 → 2026-07-24)
- Hero 3D (React Three Fiber particles, mouse-parallax, orange nebula)
- Marquee cities strip
- Catalogue (9 REAL volumes: GOOD MOOD → SUMMER BABY, 2017-2022, plays 7K→530K) + inline SoundCloud player modal loading the DJ Sayd playlist with `start_track` index per volume
- Tour (5 seeded dates: Paris, Fort-de-France, Pointe-à-Pitre, Miami, London)
- Newsletter capture → MongoDB (Resend integration deferred, awaiting API key)
- Language switcher (FR / EN / ES / Kreyòl) with localStorage persistence
- Admin CRM: JWT login, Catalogue CRUD (title/year/plays/sc_track/description/cover/listen_url), Tour CRUD, Newsletter list + CSV export
- Brand identity: GM logo integrated (top-nav + footer, inverted white on dark)
- Socials: Instagram @goodmood.fest, Instagram @sayd_artist, YouTube DJ SAYD VEVO, SoundCloud full series (footer)
- One-shot migration: only overwrites legacy demo titles, preserves any admin edits on subsequent restarts

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
