# 07 — MODÈLES DE DONNÉES (Observé)

Modèles Pydantic tirés de `backend/server.py`.

## User (embedded seed, pas de modèle explicite)
```python
{
  "email": str, "password_hash": str, "role": "admin",
  "name": str, "created_at": iso
}
```

## Volume
```python
class VolumeIn(BaseModel):
    number: str; title: str; year: Optional[str] = ""
    plays: Optional[str] = ""; description: Optional[str] = ""
    cover_url: Optional[str] = ""; listen_url: Optional[str] = ""
    sc_track: Optional[int] = None; order: int = 0
class Volume(VolumeIn):
    id: str = uuid4(); created_at: iso
```

## Event
```python
EVENT_STATUSES = {"vision","announced","on_sale","sold_out","past"}
class EventIn(BaseModel):
    name: str; city: str; country: Optional[str] = ""; venue: str
    date: str; currency: str = "eur"; capacity: int = 0
    status: str = "vision"; ticket_url: Optional[str] = ""
class Event(EventIn):
    id: str = uuid4(); created_at: iso
```

## TicketType
```python
class TicketTypeIn(BaseModel):
    event_id: str; name: str; price_cents: int; quota: int
    sale_start: Optional[str] = ""; sale_end: Optional[str] = ""
class TicketType(TicketTypeIn):
    id: str = uuid4(); sold: int = 0
    lookup_key: Optional[str] = ""
    stripe_product_id: Optional[str] = ""
    stripe_price_id: Optional[str] = ""; created_at: iso
```

## Ticket (non défini comme Pydantic — dict typé Mongo)
```python
{
  "id": uuid, "event_id": uuid, "ticket_type_id": uuid,
  "ticket_type_name": str, "event_name": str, "event_date": iso,
  "city": str, "venue": str,
  "buyer_email": str, "buyer_name": str, "session_id": str,
  "status": "valid"|"scanned"|"invalid",
  "scanned_at": iso|None, "scanned_by": email|None,
  "created_at": iso
}
```

## Fan (dict Mongo)
```python
{
  "email": lower, "external_id": "gm-fan-<local>",
  "name": str, "purchases": [{event_id, event_name, event_date, city, ticket_type, purchased_at}],
  "total_events": int, "cities": [str],
  "segments": ["primo"|"recurring", "vip"?],
  "created_at": iso, "updated_at": iso
}
```

## Product
```python
class ProductIn(BaseModel):
    name: str; description: Optional[str] = ""
    image_url: Optional[str] = ""; price_cents: int
    currency: str = "eur"; category: Optional[str] = ""
    variant_label: Optional[str] = ""; variants: List[str] = []
    active: bool = True; order: int = 0
class Product(ProductIn):
    id: str = uuid4(); lookup_key: str = ""
    stripe_product_id, stripe_price_id: str
    created_at: iso
```

## NewsletterSubscriber
```python
{ "id": uuid, "email": lower, "lang": "fr"|"en"|"es"|"kr", "subscribed_at": iso }
```

## PaymentTransaction (dict Mongo)
```python
{
  "session_id": uniq, "lookup_key", "variant", "quantity", "amount_cents", "currency",
  "type": "ticket"|"merch",
  "event_id"?, "ticket_type_id"?, "buyer_email"?,
  "status": "initiated"|"completed"|"failed",
  "payment_status": "pending"|"paid"|"failed",
  "stripe_payment_intent_id"?, "customer_email"?,
  "tickets_issued": bool, "ticket_ids": [uuid],
  "created_at", "updated_at"
}
```

## FrekIdOutbox / WalletOutbox
```python
{
  "payload": dict,
  "interaction_type": "purchase"|"entry_scan" (frek only),
  "ticket_id"?: uuid (wallet only),
  "target_url": snapshot,
  "status": "pending"|"delivered"|"failed",
  "attempts": int, "last_error": str|None,
  "next_attempt_at": iso|None, "delivered_at": iso|None,
  "created_at": iso
}
```

## Relations logiques

- `Event 1─N TicketType` (via `event_id`)
- `TicketType 1─N Ticket`
- `Fan 1─N Ticket` (via `buyer_email`)
- `PaymentTransaction 1─N Ticket` (via `session_id`)
- `Product ─ PaymentTransaction` (par `lookup_key`)
- `TicketType ─ PaymentTransaction` (par `lookup_key` pattern `gmtt_*`)
