# 02 — ARCHITECTURE (Observé + Inféré)

## 2.1 Architecture globale

Monolithe applicatif 2-tiers avec intégrations tierces synchrones et asynchrones (outbox pattern).

## 2.2 C4 — Level 1 : Context

```mermaid
C4Context
    title Good Mood — System Context
    Person(fan, "Fan / Visiteur", "Public")
    Person(admin, "Sayd / Staff", "Admin CRM & scan porte")
    System(gm, "Good Mood Platform", "Site + OS")
    System_Ext(stripe, "Stripe", "Paiement + Checkout hosted")
    System_Ext(resend, "Resend", "Email transactionnel")
    System_Ext(sc, "SoundCloud Widget API", "Lecture audio")
    System_Ext(frek, "FrekCore Socle (futur)", "FREK-ID uplink")
    System_Ext(wallet, "CVLN Wallet (futur)", "Push billet mobile")
    Rel(fan, gm, "Achète, écoute, s'inscrit")
    Rel(admin, gm, "Gère catalog, events, fans")
    Rel(gm, stripe, "Checkout + webhooks")
    Rel(gm, resend, "Envoi emails")
    Rel(gm, sc, "Embed player")
    Rel(gm, frek, "POST /frek-id/events (sync + retry)")
    Rel(gm, wallet, "POST /wallet/tickets (sync + retry)")
```

## 2.3 C4 — Level 2 : Container

```mermaid
C4Container
    title Good Mood — Containers
    Person(fan, "Fan")
    Person(admin, "Admin")
    Container(spa, "React SPA", "React 18 + CRA", "Landing, Admin, Ticket, Scan")
    Container(api, "FastAPI Backend", "Python 3.11 + Uvicorn", "REST /api/*")
    ContainerDb(mongo, "MongoDB", "Motor async", "Documents")
    Container(stripe, "Stripe", "SaaS")
    Container(resend, "Resend", "SaaS")
    Rel(fan, spa, "HTTPS")
    Rel(admin, spa, "HTTPS")
    Rel(spa, api, "REST + Bearer JWT")
    Rel(api, mongo, "Async I/O")
    Rel(api, stripe, "SDK sync")
    Rel(stripe, api, "Webhooks signés")
    Rel(api, resend, "REST sync")
```

## 2.4 C4 — Level 3 : Component (Backend)

```mermaid
graph LR
    Router[api_router /api] --> AuthMod[Auth module]
    Router --> CatMod[Catalogue module]
    Router --> EvMod[Events + Tickets]
    Router --> MerchMod[Merch]
    Router --> NewsMod[Newsletter]
    Router --> ScanMod[Scan]
    Router --> FanMod[Fans]
    Router --> PayMod[Payments]
    Router --> WebhMod[Stripe Webhook]
    PayMod --> StripeSDK[Stripe SDK]
    MerchMod --> StripeSDK
    EvMod --> StripeSDK
    WebhMod --> IssueFn[_issue_tickets_for_session]
    IssueFn --> QR[ticketing_service.generate_qr_png]
    IssueFn --> Fan[ticketing_service.upsert_fan]
    IssueFn --> Frek[frek_service.emit]
    IssueFn --> Wallet[wallet_service.push_ticket]
    IssueFn --> Email[email_service.send_ticket_confirmation]
    IssueFn --> AutoFlip[maybe_flip_event_to_soldout]
    NewsMod --> Email
    Frek --> Outbox1[(frek_id_outbox)]
    Wallet --> Outbox2[(wallet_outbox)]
    Frek --> RetryLoop1[asyncio retry_loop 30s]
    Wallet --> RetryLoop2[asyncio retry_loop 30s]
```

## 2.5 Diagramme de séquence — Achat billet (parcours critique)

```mermaid
sequenceDiagram
    autonumber
    participant F as Fan (SPA)
    participant API as FastAPI
    participant M as MongoDB
    participant S as Stripe
    participant R as Resend
    participant FR as FREK-ID (mock)
    participant W as Wallet (mock)
    F->>API: POST /api/payments/checkout {lookup_key, email, qty}
    API->>M: find ticket_type + event
    API->>M: check status='on_sale' + remaining>=qty
    API->>S: Session.create(price, metadata)
    API->>M: insert payment_transactions {pending}
    API-->>F: {checkout_url}
    F->>S: Redirection paiement CB
    S-->>F: success_url?session_id=...
    S->>API: Webhook checkout.session.completed
    API->>M: update payment_transactions {paid}
    API->>API: _issue_tickets_for_session()
    par
        API->>M: insert N tickets (uuid)
        API->>M: $inc ticket_types.sold
        API->>M: upsert fans (segments)
    end
    par
        API->>FR: POST /frek-id/events (sync, 3s timeout)
        FR-->>API: fail (no URL)
        API->>M: insert frek_id_outbox {pending}
    and
        API->>W: POST /wallet/tickets (sync, 3s timeout)
        W-->>API: fail (no URL)
        API->>M: insert wallet_outbox {pending}
    and
        API->>R: Emails.send (ticket + QR)
        R-->>API: {id}
    end
    API->>M: maybe_flip_event_to_soldout
```

## 2.6 Diagramme de séquence — Scan porte

```mermaid
sequenceDiagram
    participant S as Staff (SPA /scan)
    participant API as FastAPI
    participant M as MongoDB
    participant FR as FREK-ID
    S->>S: html5-qrcode décode QR
    S->>API: POST /api/scan/check {ticket_id, event_id} + Bearer
    API->>M: find ticket
    alt not found
        API-->>S: {result:'invalid', reason}
    else already scanned
        API-->>S: {result:'already_scanned'}
    else valid
        API->>M: update ticket {status:'scanned', scanned_at, scanned_by}
        API->>FR: emit(interaction_type='entry_scan') → outbox si fail
        API-->>S: {result:'valid', ticket}
    end
```

## 2.7 Architecture physique / cloud

```mermaid
graph TB
    Internet((Internet)) --> Ingress[Kubernetes Ingress]
    Ingress -->|/api/*| BackendPod[Backend Pod<br/>Uvicorn:8001]
    Ingress -->|/*| FrontendPod[Frontend Pod<br/>Node dev:3000]
    BackendPod --> MongoDB[(MongoDB<br/>27017)]
    BackendPod --> Stripe[Stripe SaaS]
    BackendPod --> Resend[Resend SaaS]
    BackendPod -.retry.-> Frek[FrekCore]
    BackendPod -.retry.-> Wallet[CVLN Wallet]
    Supervisor[supervisord] --> BackendPod
    Supervisor --> FrontendPod
```

## 2.8 Architecture sécurité

- **TLS** terminaison ingress (HTTPS obligatoire)
- **JWT HS256** — Bearer token 12h, secret env `JWT_SECRET`
- **bcrypt** password hashing (cost par défaut, ~12)
- **Stripe webhook signature** vérifiée (`STRIPE_WEBHOOK_SECRET`)
- **CORS** whitelist configurable
- **httpOnly cookie** disponible en fallback (route login pose aussi le cookie)

## 2.9 Composants transverses

| Composant | Impl. | Fichier |
|-----------|-------|---------|
| Authentification | JWT + bcrypt | `server.py:hash_password`, `verify_password`, `create_token`, `get_current_admin` |
| Autorisation | Rôle admin gated par dépendance FastAPI | `Depends(get_current_admin)` |
| Journalisation | `logging` stdlib format standard | `server.py` bas de fichier |
| Gestion erreurs | `HTTPException` FastAPI | Partout |
| Monitoring | supervisord logs (`/var/log/supervisor/`) | Inféré |
| Observabilité | **Non disponible dans le projet** (pas de Sentry / OpenTelemetry) | — |
| Sauvegardes | **Non disponible dans le projet** (à externaliser sur MongoDB Atlas ou snapshots K8s) | — |
| Cache | **Non disponible dans le projet** — recommandation Redis pour ticket_types hot path | — |
| Files d'attente | **Outbox pattern maison** (Mongo + retry loop asyncio) | `frek_service.py`, `wallet_service.py` |
