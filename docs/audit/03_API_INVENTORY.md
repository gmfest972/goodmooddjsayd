# 03 — INVENTAIRE API (Observé)

Format OpenAPI-like. Toutes les routes sous prefix `/api`. Auth = Bearer JWT si `admin` indiqué.

## Public

### `GET /api/`
- **Objectif** : health / info
- **Réponse 200** : `{service, status}`

### `GET /api/catalogue`
- **Objectif** : lister les 9 volumes SoundCloud
- **Réponse 200** : `Volume[]`

### `GET /api/events` (+ alias `/api/tour`)
- **Objectif** : lister les événements publics (status ≠ vision)
- **Réponse 200** : `Event[]` enrichi `ticket_types:[{id,name,price_cents,remaining,lookup_key}]`

### `GET /api/merch`
- **Objectif** : produits actifs
- **Réponse 200** : `Product[]`

### `POST /api/newsletter`
- **Body** : `{email, lang}`
- **Réponse 200** : `{ok, already:bool}`
- **Side-effect** : insert `newsletter` + envoi Resend welcome (best-effort)

### `POST /api/payments/checkout`
- **Body** : `{lookup_key, quantity(1-10), variant?, origin_url, email?}`
- **Erreurs** :
  - 404 si `lookup_key` inconnu
  - 400 si event pas `on_sale` ou remaining < quantity
  - 422 si billet sans email
- **Réponse 200** : `{checkout_url, session_id}`

### `GET /api/payments/status/{session_id}`
- **Objectif** : polling depuis `/payment/success`
- **Réponse 200** : `{session_id, status, payment_status, amount_cents, currency, type, ticket_ids}`

### `POST /api/stripe/webhook`
- **Signature** : `stripe-signature` header vérifié via `STRIPE_WEBHOOK_SECRET`
- **Événements gérés** : `checkout.session.completed`, `checkout.session.async_payment_failed`
- **Side-effects sur `completed` + type=`ticket`** : issue tickets, fan upsert, FREK-ID + Wallet emit, email confirmation, auto-flip sold_out

### `GET /api/tickets/{tid}`
- **Objectif** : vue publique du billet
- **Réponse 200** : `{ticket, event}`

### `GET /api/tickets/{tid}/qr.png`
- **Objectif** : image QR PNG (Cache-Control 1h)
- **Réponse 200** : image/png

## Auth

### `POST /api/auth/login`
- **Body** : `{email, password}`
- **Réponse 200** : `{token, user:{email,role}}` + cookie `access_token`
- **Erreur 401** : credentials invalides

### `GET /api/auth/me`
- **Auth** : Bearer
- **Réponse 200** : `{email, role}`

### `POST /api/auth/logout`
- **Réponse 200** : `{ok}`. Efface le cookie.

## Admin (Bearer JWT · role=admin)

### Catalogue
| Méthode | URL | Body |
|---------|-----|------|
| GET | `/api/admin/catalogue` | — |
| POST | `/api/admin/catalogue` | `VolumeIn` |
| PUT | `/api/admin/catalogue/{vid}` | `VolumeIn` |
| DELETE | `/api/admin/catalogue/{vid}` | — |

### Events
| Méthode | URL | Body |
|---------|-----|------|
| GET | `/api/admin/events` | — (retourne aussi `ticket_types`, `total_sold`, `total_quota`, `total_revenue_cents`) |
| POST | `/api/admin/events` | `EventIn` — 422 si status ∉ {vision,announced,on_sale,sold_out,past} |
| PUT | `/api/admin/events/{eid}` | `EventIn` |
| DELETE | `/api/admin/events/{eid}` | — (supprime aussi les ticket_types associés) |

### Ticket Types
| Méthode | URL | Body |
|---------|-----|------|
| POST | `/api/admin/events/{eid}/ticket-types` | `TicketTypeIn` — sync Stripe à chaque save |
| PUT | `/api/admin/events/{eid}/ticket-types/{tid}` | `TicketTypeIn` |
| DELETE | `/api/admin/events/{eid}/ticket-types/{tid}` | — |
| GET | `/api/admin/events/{eid}/tickets` | Liste des billets émis |
| GET | `/api/admin/events/{eid}/report` | Reporting par type + fill_rate + checked_in |

### Fans
| Méthode | URL |
|---------|-----|
| GET | `/api/admin/fans` |

### Merch
| Méthode | URL | Body |
|---------|-----|------|
| GET | `/api/admin/merch` | — |
| POST | `/api/admin/merch` | `ProductIn` — sync Stripe |
| PUT | `/api/admin/merch/{pid}` | `ProductIn` |
| DELETE | `/api/admin/merch/{pid}` | — (désactive dans Stripe) |

### Newsletter
| Méthode | URL |
|---------|-----|
| GET | `/api/admin/newsletter` |
| GET | `/api/admin/newsletter/export` — CSV |

### Orders
| Méthode | URL |
|---------|-----|
| GET | `/api/admin/orders` — `payment_transactions` triés desc |

### Outboxes (monitoring)
| Méthode | URL |
|---------|-----|
| GET | `/api/admin/outbox/frek-id` — `{count, items, configured_url}` |
| GET | `/api/admin/outbox/wallet` — idem |

### Scan (staff)
| Méthode | URL | Body |
|---------|-----|------|
| POST | `/api/scan/check` | `{ticket_id, event_id?}` — retourne `{result: valid|already_scanned|invalid, ticket?}` |
| GET | `/api/scan/counter/{eid}` | `{event_id, capacity, scanned, issued}` |

## Exemples

**Login** :
```bash
curl -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@goodmood.com","password":"GoodMood2026"}'
```

**Checkout billet** :
```bash
curl -X POST $API/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"lookup_key":"gmtt_xxxxxxxx","quantity":2,"email":"fan@ex.com","origin_url":"https://goodmood.fest"}'
```

**Scan** :
```bash
curl -X POST $API/api/scan/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"uuid","event_id":"eid"}'
```
