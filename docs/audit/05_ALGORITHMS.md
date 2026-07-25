# 05 — ALGORITHMES MÉTIER (Observé)

## ALG-001 — Sync produit/ticket-type vers Stripe (idempotent par lookup_key)
- **Objectif** : maintenir la parité Mongo↔Stripe (product + active price) sans doublon
- **Entrées** : doc (id, name, description, image_url, price_cents, currency, stripe_product_id?)
- **Sorties** : doc mutée avec `lookup_key`, `stripe_product_id`, `stripe_price_id`
- **Pré** : Stripe SDK configuré
- **Post** : Stripe contient exactement 1 product + 1 active price avec ce lookup_key
- **Complexité** : O(1) (3 appels Stripe max)
- **Pseudo-code** :
```
lookup_key := prefix + "_" + id[:8]
if stripe_product_id: modify Product else: create Product
prices := Stripe.Price.list(lookup_keys=[lookup_key], active=True)
if prices exist AND (amount or currency changed):
    deactivate prices[0]
    prices := []
if prices exist: reuse prices[0].id
else: create Price(product, unit_amount, currency, lookup_key)
return {lookup_key, product_id, price_id}
```
- **Dépendances** : `stripe` SDK
- **Fichier** : `server.py:_sync_stripe_item`, `_sync_product_to_stripe`, `_sync_ticket_type_to_stripe`
- **Endpoints** : POST/PUT `/api/admin/merch`, `/api/admin/events/{eid}/ticket-types`

## ALG-002 — Issue tickets (post-payment, idempotent)
- **Objectif** : matérialiser N billets, mettre à jour quotas, déclencher tous les side-effects
- **Entrées** : `session_obj` Stripe, `origin_url`
- **Sorties** : `List[ticket_id]`
- **Pré** : `payment_transactions[session_id]` existe, `type='ticket'`
- **Post** : N tickets créés, sold incrémenté, fan upserté, FREK+Wallet emit, email envoyé, event peut passer sold_out
- **Idempotence** : garde-fou `tx.tickets_issued` — 2ᵉ appel = no-op
- **Complexité** : O(N) où N = quantity (≤10)
- **Pseudo-code** :
```
tx := payment_transactions[session_id]
if tx.type != 'ticket' OR tx.tickets_issued: return existing
tickets := []
for i in range(qty):
    tid := uuid4()
    insert Ticket(status='valid')
    tickets.append(tid)
ticket_types.$inc(sold, qty)  # atomic
mark tx.tickets_issued = true
upsert_fan(email, purchase)
try: frek_service.emit(purchase) — outbox si fail
for tid: try: wallet_service.push_ticket(tid) — outbox si fail
send_ticket_confirmation(email, first_ticket_url, qr_url)
maybe_flip_event_to_soldout(event_id)
return tickets
```
- **Fichier** : `server.py:_issue_tickets_for_session`
- **Endpoints** : webhook `checkout.session.completed`

## ALG-003 — Segmentation fan (primo / recurring / vip)
- **Objectif** : classer chaque fan à chaque achat
- **Entrées** : purchases list (existante + nouvelle)
- **Sorties** : `segments: string[]`
- **Complexité** : O(P) sur purchases
- **Pseudo-code** :
```
segments := ['primo'] if len(purchases) == 1 else ['recurring']
if any(p.ticket_type.upper().startswith('VIP') for p in purchases):
    segments += ['vip']
return segments
```
- **Fichier** : `ticketing_service.py:upsert_fan`

## ALG-004 — Auto-flip event → sold_out
- **Objectif** : basculer automatiquement l'event si tous types sont épuisés
- **Entrées** : event_id
- **Complexité** : O(T) sur ticket_types
- **Pseudo-code** :
```
types := ticket_types.find(event_id=eid)
if empty: return False
if all(t.sold >= t.quota for t in types):
    events.update(status='sold_out')
    return True
return False
```
- **Fichier** : `ticketing_service.py:maybe_flip_event_to_soldout`

## ALG-005 — Outbox pattern + retry exponentiel (FREK-ID / Wallet)
- **Objectif** : garantir livraison at-least-once vers systèmes tiers non fiables, sans bloquer l'expérience utilisateur
- **Entrées** : payload, target_url
- **Complexité** : O(1) par tentative
- **Backoffs** : `[30s, 2m, 10m, 1h, 6h]`, puis `failed`
- **Pseudo-code (emit)** :
```
ok, err := HTTP POST(url, payload) with 3s timeout
insert outbox(payload, status=delivered if ok else pending, next_attempt=now+30s, attempts=1)
return 'delivered' | 'queued'
```
- **Pseudo-code (retry_loop, background)** :
```
loop forever:
    now := utcnow_iso
    for doc in outbox.find(status='pending', next_attempt_at<=now).sort(created).limit(20):
        ok, err := HTTP POST(...)
        attempts := doc.attempts + 1
        if ok: mark delivered
        elif attempts > len(backoffs): mark failed
        else: schedule next_attempt = now + backoffs[attempts-1]
    sleep 30
```
- **Fichier** : `frek_service.py`, `wallet_service.py`
- **Innovation** : implémenté "socle-agnostic" — le jour où FrekCore est up, un flip d'env var suffit ; les items pending seront livrés au premier passage du retry_loop

## ALG-006 — Génération QR code
- **Objectif** : QR PNG 500×500 haute correction pour le ticket_id
- **Entrées** : ticket_id (uuid str)
- **Sorties** : bytes PNG
- **Complexité** : O(1)
- **Détails** : `error_correction=H` (résiste à 30% d'occlusion), `box_size=10`, couleurs brand (#050505 / blanc)
- **Fichier** : `ticketing_service.py:generate_qr_png`

## ALG-007 — Polling status paiement avec fallback Stripe (SPA `/payment/success`)
- **Objectif** : ne pas dépendre uniquement du webhook — vérifier Stripe direct si pending
- **Complexité** : O(1) par poll (15 essais, 2s intervalle côté client = ~30s)
- **Pseudo-code (backend)** :
```
record := payment_transactions[session_id]
if record.payment_status != 'paid':
    s := Stripe.Session.retrieve(session_id)
    if s.payment_status == 'paid':
        update payment_transactions(paid, payment_intent, customer_email)
        record := reload
return record
```
- **Fichier** : `server.py:get_payment_status`

## ALG-008 — Migration une-fois Tour → Events (idempotente)
- **Complexité** : O(N) sur ancien tour
- **Condition** : `events.count == 0 AND tour.count > 0`
- **Mapping** : status `soldout` → `sold_out`, sinon `announced` ; ID conservé
- **Fichier** : `server.py:startup`

## ALG-009 — Backfill catalogue (idempotent, gated)
- **Objectif** : mettre à jour titres/covers/URLs SC sur les docs seedés, sans jamais écraser une édition admin
- **Gate** : `title IN LEGACY_TITLES OR listen_url == PLAYLIST_URL`
- **Fichier** : `server.py:startup`
- **Innovation** : gate "signature de seed" — permet d'itérer sur le seed sans risque de collision admin

## ALG-010 — Rotation front-end 3D fixe + parallaxe souris
- **Objectif** : rendu Three.js d'un champ de particules avec parallaxe mouse-driven
- **Complexité** : O(N) sur particules à chaque frame (N=1800)
- **Fichier** : `Hero3DCanvas.jsx` (~fonction `useFrame`)
