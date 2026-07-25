# 13 — README DÉVELOPPEUR

## Good Mood — Site vitrine + OS interne

Plateforme unifiée pour la marque **Good Mood** (spinoff DJ Sayd, pôle Events CVLN Groupe) : site public + back-office CRM + billetterie interne Stripe + fan CRM propriétaire + interop FREK-ID.

## Prérequis

- Python 3.11+
- Node.js 18+ (yarn 1.x)
- MongoDB 6+ (local ou Atlas)
- Compte Stripe (test ou live)
- Compte Resend (optionnel, pour emails)

## Installation

```bash
git clone <repo>
cd good-mood

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # renseigner les valeurs
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (autre terminal)
cd frontend
yarn install
cp .env.example .env  # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

## Configuration — variables d'environnement

**backend/.env** :
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=goodmood
CORS_ORIGINS=*
JWT_SECRET=<hex 64>
ADMIN_EMAIL=admin@goodmood.com
ADMIN_PASSWORD=<strong password>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...              # vide = emails skippés
SENDER_EMAIL=hello@goodmood.fest
SENDER_NAME=Good Mood
PUBLIC_BASE_URL=https://goodmood.fest
FREK_ID_URL=                       # vide = outbox seul, flip quand FrekCore up
FREK_ID_TOKEN=
WALLET_URL=
WALLET_TOKEN=
```

**frontend/.env** :
```
REACT_APP_BACKEND_URL=https://api.goodmood.fest
```

## Lancement

- Local dev : `uvicorn server:app --reload` + `yarn start`
- Production K8s : géré par supervisord (`backend` + `frontend`)

## Build

```bash
cd frontend && yarn build      # → build/ statique
```

## Tests

```bash
cd backend
pytest tests/                   # suite complète
pytest tests/test_iter8.py -v   # itération spécifique
```

## Debugging

- Backend logs : `tail -f /var/log/supervisor/backend.err.log`
- Frontend logs : `tail -f /var/log/supervisor/frontend.err.log`
- Mongo direct : `mongosh $MONGO_URL/$DB_NAME`
- Stripe dashboard : https://dashboard.stripe.com (mode test)
- Resend dashboard : https://resend.com/emails
- Outboxes monitor : `GET /api/admin/outbox/{frek-id|wallet}`

## Comptes seedés

Voir `memory/test_credentials.md` :
- Admin `admin@goodmood.com` / `GoodMood2026`

## Bonnes pratiques

- ✅ Jamais commit `.env`
- ✅ Toutes routes backend préfixées `/api`
- ✅ Utiliser `REACT_APP_BACKEND_URL` côté frontend (jamais de localhost hardcodé)
- ✅ Ajouter `data-testid` sur tout élément interactif
- ✅ Migrations Mongo idempotentes uniquement (jamais de destructive default)
- ✅ Stripe : lookup_key stable, ne jamais changer le prefix (`gm_` merch, `gmtt_` ticket)
- ✅ Emails et FREK-ID/Wallet en best-effort — jamais bloquant sur l'expérience utilisateur

## Déploiement

Actuellement K8s + supervisord. Ports internes : backend 8001, frontend 3000. Ingress route `/api/*` → backend, `/*` → frontend.

Pour un fork indépendant : Docker Compose (docker-compose.yml à créer) ou Kubernetes manifests dédiés.
