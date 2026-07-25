# 11 — TESTS

## Suites existantes (Observé)

Backend : `backend/tests/`
- `test_iter5.py` — global 3D bg + empty merch state + Resend scaffold
- `test_iter6.py` — Instagram fix + FMS + Tour ticketing Stripe
- `test_iter7.py` — hotfix branding index.html
- `test_iter8.py` — 23 tests Billetterie & CRM (Events, ticket types, checkout, scan, fans, outboxes)
- `test_merch_payments.py` — Merch Stripe flow
- `test_catalogue_real_data.py` — validation seed catalogue

Frontend : pas de test unitaire présent. Validation via testing subagent (Playwright piloté par un agent QA).

## Couverture actuelle

| Couche | Tests | Couverture estimée |
|--------|-------|--------------------|
| API publique (catalogue, events, merch, newsletter) | ✓ | ~95% |
| API auth | ✓ | ~90% |
| API admin CRUD | ✓ | ~85% |
| Webhook Stripe | ⚠ Partiel (signature vérifiée sans simulation complète) | ~60% |
| Scan flow | ✓ (invalid/valid/already_scanned) | 100% |
| Outboxes FREK-ID / Wallet | ✓ Structure OK, pas de test retry_loop | ~70% |
| Fan CRM segmentation | ✓ Indirect via achat mocké | ~80% |
| Frontend composants | ✗ Aucun test unitaire | 0% |
| Frontend E2E | ✓ Via testing agent (non exécuté en CI) | manuel |

## Couverture manquante (Recommandations)

1. **Test unitaire `ticketing_service.upsert_fan`** — vérifier segmentation VIP + recurring
2. **Test retry loop FREK-ID** — simuler URL qui répond puis stopper le loop
3. **Test idempotence `_issue_tickets_for_session`** — double appel = même résultat
4. **Test race condition quota** — 2 achats concurrents sur le dernier billet
5. **Tests E2E Playwright** dans le repo (aujourd'hui hors repo)
6. **Test frontend Jest/RTL** — au moins pour `TicketPicker`, `SoundCloudPlayer`, `StaffScan`
7. **Contract test Stripe webhook** — payload factices signés

## Propositions concrètes

```python
# tests/test_fan_segmentation.py
async def test_vip_segment():
    await upsert_fan(db, email="a@b.c", ticket_type="VIP Gold", ...)
    fan = await db.fans.find_one({"email":"a@b.c"})
    assert "vip" in fan["segments"]

async def test_recurring_segment():
    await upsert_fan(db, email="x@y.z", ticket_type="Standard", ...)  # 1st
    await upsert_fan(db, email="x@y.z", ticket_type="Standard", ...)  # 2nd
    fan = await db.fans.find_one({"email":"x@y.z"})
    assert fan["total_events"] == 2
    assert "recurring" in fan["segments"]
```

```python
# tests/test_idempotence.py
async def test_issue_tickets_twice_is_no_op():
    session = {"id":"cs_xxx", "customer_details":{"email":"a@b.c","name":""}}
    # seed payment_transactions
    r1 = await _issue_tickets_for_session(session)
    r2 = await _issue_tickets_for_session(session)  # second call
    assert r1 == r2
    tickets = await db.tickets.find({"session_id":"cs_xxx"}).to_list(100)
    assert len(tickets) == len(r1)  # not doubled
```
