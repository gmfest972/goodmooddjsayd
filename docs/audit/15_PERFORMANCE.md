# 15 — PERFORMANCE

## Complexité par endpoint clé

| Endpoint | Complexité | Bottleneck potentiel |
|----------|-----------|----------------------|
| `GET /api/events` | O(E + T) avec E events, T ticket_types (N queries — 1 par event) | 🔴 N+1 pattern |
| `GET /api/catalogue` | O(N) | ✅ Faible (max 9) |
| `POST /api/payments/checkout` | O(1) + latence Stripe (~200ms) | Stripe latency |
| `POST /api/stripe/webhook` | O(qty) sur tickets + 3 appels externes | Cascade externe |
| `POST /api/scan/check` | O(1) find + O(1) update + emit outbox | ✅ Rapide |
| `GET /api/admin/events` | O(E + T) | Idem `GET /events` |
| `GET /api/admin/fans` | O(F) — full scan | À paginer si > 5000 |
| `GET /api/admin/orders` | O(P) — full scan | À paginer |
| Frontend `Hero3DCanvas` | O(N=1800) par frame @ 60fps | GPU-bound, tests OK |

## Temps de réponse estimés

Sur infra actuelle (Mongo local, Stripe US latence ~200ms) :

| Route | P50 | P95 |
|-------|-----|-----|
| GET public | 30ms | 100ms |
| POST checkout | 250ms | 450ms |
| Webhook Stripe | 800ms (3 externes séquentiels) | 2000ms |
| Scan check | 40ms | 120ms |

## Base de données

- **Indexes créés** (voir `06_DATABASE.md`) : email uniques, session_id, event_id, lookup_key, outbox composite
- **Manque** :
  - Index composite `payment_transactions(status, created_at)` pour listing admin
  - Index sur `tickets(buyer_email)` pour retrouver les billets d'un fan
  - Index sur `tickets(status, event_id)` pour scan counter

## Cache

- ❌ Aucun cache en cache-couche (Redis, Memcached)
- ✅ Cache-Control 1h sur `/api/tickets/{id}/qr.png` (statique par UUID)
- ✅ Frontend : localStorage pour token + lang

## Goulots d'étranglement

### 🔴 Priorité 1 — N+1 sur `GET /api/events`
- **Symptôme** : pour E events, on fait E queries `ticket_types`
- **Impact** : à 50 events → 51 queries
- **Solution** : `$lookup` MongoDB (aggregation pipeline) OU cache en RAM (invalidation sur write)
- **Effort** : 2h

### 🟡 Priorité 2 — Webhook Stripe séquentiel
- **Symptôme** : email + FREK-ID + Wallet en série
- **Impact** : latence webhook = somme des latences
- **Solution** : `asyncio.gather` sur les 3 side-effects (Resend + FREK + Wallet)
- **Effort** : 1h

### 🟡 Priorité 3 — Retry loops sur même DB
- **Symptôme** : 2 loops asyncio scannent `outbox` toutes les 30s
- **Impact** : négligeable en Phase 1, à surveiller à l'échelle
- **Solution** : job queue dédié (Celery + Redis) OU worker externe
- **Effort** : Phase 2

### 🟢 Priorité 4 — Frontend bundle
- **Actuel** : React CRA non optimisé (webpack v4)
- **Recommandation** : migrer vers Vite en Phase 2 pour temps de build 5-10× plus rapide

## Optimisations recommandées

1. **Mongo aggregation** pour `GET /api/events` (économie N-1 queries)
2. **Pagination** `/api/admin/orders`, `/api/admin/fans`, `/api/admin/newsletter`
3. **`asyncio.gather`** sur side-effects webhook
4. **Redis cache** pour `ticket_types.remaining` (hot path avant checkout)
5. **Index composites** manquants (voir DB section)
6. **CDN** pour `/logo-gm.png`, covers SC (déjà sur CDN SoundCloud) et assets statiques
7. **Vite** en Phase 2 pour builds frontend
8. **HTTP/2** ingress (actuellement supposé HTTP/1.1)
