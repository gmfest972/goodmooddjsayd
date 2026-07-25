# 04 — RÈGLES MÉTIER (Observé)

| ID | Description | Contraintes | Fichier |
|----|-------------|-------------|---------|
| **RULE-001** | Un event a exactement un statut parmi 5 : vision, announced, on_sale, sold_out, past | 422 si autre valeur | `server.py:EVENT_STATUSES` |
| **RULE-002** | Un event `vision` n'est jamais retourné par l'API publique | Filtre `status != vision` | `server.py:public_events` |
| **RULE-003** | Seul un event `on_sale` autorise la vente réelle | 400 sinon | `server.py:create_checkout` |
| **RULE-004** | Un achat de billet exige un email acheteur | 422 si absent | `create_checkout` |
| **RULE-005** | La quantité par transaction est plafonnée à 10 | Pydantic `le=10` | `CheckoutRequest` |
| **RULE-006** | La vente est refusée si `remaining < quantity` (quota disponible) | 400 | `create_checkout` |
| **RULE-007** | Chaque billet acheté produit N `tickets` distincts (1 doc = 1 entrée physique) | boucle `range(qty)` | `_issue_tickets_for_session` |
| **RULE-008** | À chaque billet émis : `ticket_types.sold` est incrémenté atomiquement de `qty` | `$inc` Mongo | `_issue_tickets_for_session` |
| **RULE-009** | Si tous les ticket_types d'un event ont sold ≥ quota, l'event bascule automatiquement en `sold_out` | Vérif après chaque vente | `maybe_flip_event_to_soldout` |
| **RULE-010** | Un billet a exactement un statut : valid / scanned / invalid | Défaut à `valid` à la création | Model `Ticket` |
| **RULE-011** | Un scan de billet déjà scanné retourne `already_scanned` (jamais valide 2 fois) | Check `status == scanned` | `scan_check` |
| **RULE-012** | Un scan valide met `status=scanned`, `scanned_at`, `scanned_by=admin.email` | | `scan_check` |
| **RULE-013** | À chaque vente ET chaque scan, un événement FREK-ID est émis synchrone + fallback outbox | Non négociable (spec Good Mood OS §8) | `_issue_tickets_for_session`, `scan_check` |
| **RULE-014** | À chaque billet émis, un push wallet CVLN est tenté + fallback outbox | | `_issue_tickets_for_session` |
| **RULE-015** | L'email reste toujours en canal parallèle (jamais unique) | Envoi Resend systématique | `_issue_tickets_for_session` |
| **RULE-016** | Un fan est identifié par son email (lowercase) — 1 fan = 1 email | Index unique `fans.email` | `upsert_fan` |
| **RULE-017** | Segments fan calculés à chaque upsert : primo (1 achat), recurring (≥2), vip (au moins un achat de type VIP*) | Case-insensitive `startswith('VIP')` | `upsert_fan` |
| **RULE-018** | Un produit Merch avec `active=false` n'apparaît pas côté public | Filtre | `public_merch` |
| **RULE-019** | Un ticket_type / product change de prix → l'ancien price Stripe est désactivé, un nouveau créé (lookup_key stable) | | `_sync_stripe_item` |
| **RULE-020** | Un email newsletter est unique (index) | Retourne `{already:true}` si existe | `public_newsletter` |
| **RULE-021** | Seuls les admins (rôle `admin`) accèdent aux routes `/api/admin/*` et `/api/scan/*` | Dépendance `get_current_admin` | `server.py` |
| **RULE-022** | Un JWT expire après 12h | `exp=now+12h` | `create_token` |
| **RULE-023** | Un webhook Stripe sans signature valide est rejeté 400 | `construct_event` avec secret | `stripe_webhook` |
| **RULE-024** | Les paiements sont idempotents : `session_id` unique, `tickets_issued=true` bloque une double émission | Index unique + garde-fou | `payment_transactions`, `_issue_tickets_for_session` |
| **RULE-025** | Les 9 volumes du catalogue sont seedés à la première initialisation ; les éditions admin ultérieures ne sont jamais écrasées par la migration | Filtre `title in LEGACY_TITLES` OR `listen_url == PLAYLIST_URL` | `startup` |
| **RULE-026** | Les 5 dates de tour legacy sont migrées en events statut `announced` une seule fois | `if events empty and tour has data` | `startup` |
| **RULE-027** | Retry FREK-ID / Wallet : backoffs 30s / 2m / 10m / 1h / 6h — 5 tentatives max puis `failed` | | `frek_service.RETRY_BACKOFFS_SEC` |
| **RULE-028** | Un billet permet d'accéder à `/ticket/{id}` sans authentification (le QR est le token de possession) | Pas de Depends | `public_ticket` |
| **RULE-029** | Un scan ne bloque JAMAIS l'expérience fan si FREK-ID indisponible (best-effort → outbox) | try/except autour de `frek_service.emit` | `scan_check` |
| **RULE-030** | Un lookup_key Stripe est stable pour la durée de vie du ticket_type / product | Format `gmtt_<8char>` ou `gm_<8char>` | `_sync_stripe_item` |
