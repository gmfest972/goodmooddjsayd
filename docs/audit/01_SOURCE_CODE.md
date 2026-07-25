# 01 — CODE SOURCE (Observé)

## Arborescence complète

```
/app
├── backend/
│   ├── .env                       Variables d'environnement (secrets — non commit)
│   ├── requirements.txt           Dépendances Python (freeze)
│   ├── server.py                  874 l. — Application FastAPI, routes, modèles, startup
│   ├── email_service.py           134 l. — Resend intégration + templates HTML
│   ├── frek_service.py            127 l. — Outbox FREK-ID + retry loop
│   ├── wallet_service.py          115 l. — Outbox CVLN Wallet + retry loop
│   ├── ticketing_service.py        84 l. — QR generator, fan CRM upsert, auto-flip sold_out
│   └── tests/                     Suites pytest par itération
├── frontend/
│   ├── .env                       REACT_APP_BACKEND_URL
│   ├── package.json               Deps (yarn)
│   ├── craco.config.js            Alias @ → src
│   ├── tailwind.config.js         Tailwind + shadcn tokens
│   ├── postcss.config.js
│   ├── public/
│   │   ├── index.html             Meta brand (no Emergent trace)
│   │   └── logo-gm.png            Logo GM 33KB
│   └── src/
│       ├── App.js                 Router (Landing, Admin, Ticket, Scan, Payment)
│       ├── index.js               React root
│       ├── index.css              Design tokens + composants CSS custom
│       ├── App.css                Minimal
│       ├── api.js                 Axios client + Bearer injector
│       ├── i18n.js                4 langues (FR/EN/ES/KR)
│       ├── components/
│       │   ├── Hero3DCanvas.jsx   Particules Three.js
│       │   ├── TopNav.jsx         Nav fixée + logo
│       │   ├── LanguageSwitcher.jsx
│       │   ├── Catalogue.jsx      9 volumes SC
│       │   ├── SoundCloudPlayer.jsx Modal SC.Widget
│       │   ├── Tour.jsx           Events public + TicketPicker
│       │   ├── Merch.jsx          Store public
│       │   ├── Newsletter.jsx     Capture email
│       │   └── ui/                shadcn/ui (Radix)
│       └── pages/
│           ├── Landing.jsx        Home orchestrator
│           ├── AdminLogin.jsx     JWT login
│           ├── AdminDashboard.jsx CRM 6 onglets
│           ├── PaymentSuccess.jsx Polling status
│           ├── PaymentCancel.jsx
│           ├── TicketView.jsx     Billet public + QR
│           └── StaffScan.jsx      Caméra scan door
├── docs/audit/                   Ce dossier
└── memory/
    ├── PRD.md                    Product Requirements Document
    └── test_credentials.md       Compte admin
```

## Rôle par dossier

| Dossier | Rôle |
|---------|------|
| `backend/` | API FastAPI, logique métier, intégrations Stripe/Resend/FREK-ID/Wallet |
| `backend/tests/` | Suites pytest — 1 par itération (test_iter5..8, test_merch_payments, test_catalogue_real_data) |
| `frontend/src/components/` | Composants UI réutilisables (métier + shadcn) |
| `frontend/src/pages/` | Pages routées via React Router |
| `frontend/src/components/ui/` | shadcn/ui — non modifié, réutilisable |
| `frontend/plugins/health-check/` | Plugin webpack maison (health endpoints) |
| `memory/` | Docs de travail (PRD, credentials) |

## Frameworks & langages

**Backend**
- Python 3.11
- FastAPI 0.110.1 (routing, DI, validation)
- Uvicorn 0.25.0 (ASGI server, géré par supervisor)
- Motor 3.3.1 + PyMongo 4.6.3 (Mongo async)
- Pydantic 2.13.4 (models)
- Stripe 14.4.1 (SDK)
- Resend 2.34.0 (email)
- qrcode 8.2 (PIL) + Pillow (transitive)
- httpx 0.28.1 (async HTTP → FREK-ID / Wallet)
- bcrypt 4.1.3 (hash mdp)
- PyJWT 2.13.0 (JWT HS256)
- python-dotenv 1.2.2

**Frontend**
- React 18 + Create React App (via CRACO)
- react-router-dom 6 (routing)
- axios (HTTP)
- three 0.185.1 + @react-three/fiber 9.6.1 (3D hero)
- html5-qrcode 2.3.8 (scan caméra)
- react-i18next 26.3.6 + i18next
- Tailwind CSS 3 + shadcn/ui + Radix primitives
- lucide-react (icônes)
- sonner (toasts)

## Licences de dépendances (Observé)

| Dépendance | Licence |
|-----------|---------|
| FastAPI | MIT |
| Uvicorn | BSD-3 |
| Motor / PyMongo | Apache-2.0 |
| Pydantic | MIT |
| Stripe SDK | MIT |
| Resend | MIT |
| qrcode | BSD |
| httpx | BSD-3 |
| bcrypt | Apache-2.0 |
| PyJWT | MIT |
| React | MIT |
| three.js | MIT |
| @react-three/fiber | MIT |
| Tailwind | MIT |
| shadcn/ui | MIT |
| Radix UI | MIT |
| html5-qrcode | Apache-2.0 |
| react-i18next | MIT |
| axios | MIT |
| lucide-react | ISC |
| sonner | MIT |

→ Toutes les dépendances sont permissives — compatibles avec un produit propriétaire commercial. **Aucune GPL/AGPL détectée.**

## Modules internes

| Module | Type | Fichier |
|--------|------|---------|
| `email_service` | Service | Envoi transactionnel Resend, 3 templates |
| `frek_service` | Service | Outbox pattern + retry (backoff exponentiel) |
| `wallet_service` | Service | Idem pour wallet CVLN |
| `ticketing_service` | Service | QR, fan CRM, auto-flip event |
| `api.js` | Helper | Client axios avec interceptor Bearer |
| `i18n.js` | Helper | Init i18next + resources 4 langues |

## Variables d'environnement (secrets attendus)

**Backend `.env` — jamais commit** :
| Clé | Type | Description |
|-----|------|-------------|
| `MONGO_URL` | URI | Mongo connection string |
| `DB_NAME` | string | Nom base Mongo |
| `CORS_ORIGINS` | csv | Origines autorisées CORS |
| `JWT_SECRET` | hex 64 | Secret HS256 |
| `ADMIN_EMAIL` | email | Compte admin seedé |
| `ADMIN_PASSWORD` | string | Mot de passe admin seedé |
| `STRIPE_SECRET_KEY` | sk_test_... / sk_live_... | Clé secrète Stripe |
| `STRIPE_PUBLISHABLE_KEY` | pk_test_... / pk_live_... | Clé publique |
| `STRIPE_ACCOUNT_ID` | acct_... | Compte Stripe |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | Signature webhook |
| `STRIPE_MODE` | test/live | Mode |
| `RESEND_API_KEY` | re_... | Clé Resend |
| `SENDER_EMAIL` | email | From address |
| `SENDER_NAME` | string | From name |
| `PUBLIC_BASE_URL` | URL | Base pour QR + liens ticket dans email |
| `FREK_ID_URL` | URL | Endpoint FrekCore (vide = outbox seul) |
| `FREK_ID_TOKEN` | Bearer | Token FrekCore |
| `WALLET_URL` | URL | Endpoint CVLN Wallet |
| `WALLET_TOKEN` | Bearer | Token Wallet |

**Frontend `.env`** :
| Clé | Description |
|-----|-------------|
| `REACT_APP_BACKEND_URL` | URL API publique |
