# 14 — AUDIT SÉCURITÉ

## Contrôles présents (Observé)

| Contrôle | Impl. | Fichier |
|----------|-------|---------|
| Password hashing | bcrypt (cost 12 par défaut) | `server.py:hash_password` |
| JWT signé HS256 | `PyJWT`, exp 12h, secret env | `create_token` |
| Autorisation route | Dépendance FastAPI `get_current_admin` | Toutes routes `/api/admin/*` + `/api/scan/*` |
| Stripe webhook signature | `stripe.Webhook.construct_event` | `stripe_webhook` |
| CORS | Whitelist configurable | Middleware |
| Validation input | Pydantic strict (types, ranges, enums) | Tous les modèles |
| Idempotence webhook | Garde-fou `tickets_issued` + index unique `session_id` | `_issue_tickets_for_session` |
| HTTPS | Terminaison ingress K8s | Infra |

## Analyse OWASP Top 10

| Risque | État | Notes |
|--------|------|-------|
| **A01 Broken Access Control** | ✅ | Bearer JWT + role check ; ticket public accessible par UUID (RULE-028 — c'est un design choice, le QR est le token) |
| **A02 Cryptographic Failures** | ✅ | bcrypt, JWT HS256, TLS ingress. Recommandation : rotation `JWT_SECRET` |
| **A03 Injection** | ✅ | Pas de SQL. Motor/PyMongo échappe les queries. Pas d'`eval`/`exec` |
| **A04 Insecure Design** | ⚠ | Voir "Recommandations" (rate limit, quota lock) |
| **A05 Security Misconfiguration** | ⚠ | `CORS_ORIGINS=*` par défaut → à restreindre en prod |
| **A06 Vulnerable Components** | ✅ | Toutes deps à jour (Stripe 14.4, FastAPI 0.110, Pydantic 2.13). Recommandation : `pip-audit` en CI |
| **A07 Identification & Auth** | ✅ | bcrypt + JWT ; **pas de brute-force protection** (Recommandation) |
| **A08 Software & Data Integrity** | ✅ | Webhooks signés Stripe |
| **A09 Logging & Monitoring** | ⚠ | `logging` stdlib basique. Pas de Sentry/OpenTelemetry (Recommandation) |
| **A10 SSRF** | ✅ | Pas d'input URL fetchée depuis le backend (le seul cas : httpx vers FREK_ID_URL et WALLET_URL, contrôlées par env — non user-controlled) |

## Failles potentielles identifiées

### 🟡 MEDIUM — Absence de rate limiting
- Impact : brute force login, spam newsletter
- Recommandation : `slowapi` (5 login attempts / 15 min IP)

### 🟡 MEDIUM — CORS wildcard par défaut
- Impact : XSS depuis un site tiers pourrait poster sur `/api/newsletter`
- Recommandation : `CORS_ORIGINS=https://goodmood.fest` en prod

### 🟡 MEDIUM — Race condition quota
- Scénario : 2 achats concurrents alors qu'il ne reste qu'1 billet → 2 tickets émis
- Actuel : check `remaining >= qty` puis `$inc` non-atomique
- Recommandation : findOneAndUpdate avec condition atomique (`$inc` + check sold ≤ quota) ; ou verrou optimiste

### 🟢 LOW — Ticket view public sans auth
- Design intentionnel (le QR est le token de possession)
- Mitigation : UUID v4 non-devinable + pas de champ sensible (pas de card, pas de mdp)

### 🟢 LOW — Retry loop sans limitation IP
- Non user-controlled, cible dedicated endpoints (`FREK_ID_URL`, `WALLET_URL`)

### 🟢 LOW — Reset password non implémenté
- Actuel : seed forcé au boot si mdp `.env` change
- Recommandation Phase 2 : magic link Resend

## Gestion des secrets

- ✅ Aucun secret en clair dans le repo (vérifié)
- ✅ Tous via `.env` (jamais commit — voir `.gitignore` recommandé)
- ✅ Rotation possible via env var
- ⚠ **Actuel** : `ADMIN_PASSWORD` en env clair → recommandation : hash `bcrypt` déjà seedé, jamais reset

## Recommandations sécurité prioritaires

1. **Restreindre CORS** en prod : `CORS_ORIGINS=https://goodmood.fest`
2. **Ajouter rate limit** login (`slowapi` ou middleware custom)
3. **Passer JWT à cookies httpOnly + SameSite=Lax** pour front web (actuellement Bearer localStorage — XSS-visible)
4. **Activer `pip-audit` + `yarn audit`** en CI
5. **Ajouter Sentry** (traces + errors)
6. **Ajouter Content-Security-Policy** header
7. **Test brute force login** — après 5 échecs, cooldown IP
8. **Rate limit newsletter** (max 1 email / 60s / IP)
9. **Verrou quota atomique** via `findOneAndUpdate` conditionnel
10. **Rotation périodique** `JWT_SECRET` (impact : logout global — acceptable Phase 1)
