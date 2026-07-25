"""Merch + Stripe checkout + Admin orders tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://groove-studio-21.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@goodmood.com"
ADMIN_PASSWORD = "GoodMood2026"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --------- Public Merch ---------
def test_public_merch_returns_seeded_tee(api):
    r = api.get(f"{BASE_URL}/api/merch")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    tee = next((p for p in items if p["name"] == "Good Mood Tee — Vol.1"), None)
    assert tee is not None, f"Seeded tee not found in: {[p['name'] for p in items]}"
    assert tee["price_cents"] == 3500
    assert tee["currency"] == "eur"
    assert set(tee["sizes"]) == {"S", "M", "L", "XL"}
    assert tee["active"] is True
    assert tee.get("stripe_product_id")
    assert tee.get("stripe_price_id")
    assert tee.get("lookup_key")
    assert tee["lookup_key"].startswith("gm_")


# --------- Payments ---------
@pytest.fixture(scope="module")
def seeded_lookup_key(api):
    r = api.get(f"{BASE_URL}/api/merch")
    tee = next((p for p in r.json() if p["name"] == "Good Mood Tee — Vol.1"), r.json()[0])
    return tee["lookup_key"]


@pytest.fixture(scope="module")
def checkout_session(api, seeded_lookup_key):
    r = api.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": seeded_lookup_key,
        "quantity": 2,
        "size": "M",
        "origin_url": "https://example.com",
    })
    assert r.status_code == 200, f"Checkout failed: {r.status_code} {r.text}"
    data = r.json()
    assert "checkout_url" in data and "session_id" in data
    assert data["checkout_url"].startswith("https://checkout.stripe.com/")
    return data


def test_checkout_creates_stripe_session(checkout_session):
    assert checkout_session["session_id"].startswith("cs_")


def test_checkout_invalid_lookup_key_404(api):
    r = api.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": "does_not_exist_xyz",
        "quantity": 1,
        "size": "M",
        "origin_url": "https://example.com",
    })
    assert r.status_code == 404


def test_payment_status_pending(api, checkout_session):
    sid = checkout_session["session_id"]
    r = api.get(f"{BASE_URL}/api/payments/status/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["session_id"] == sid
    assert data["payment_status"] == "pending"
    assert data["amount_cents"] == 3500 * 2
    assert data["currency"] == "eur"
    assert "status" in data


# --------- Admin auth-gated ---------
def test_admin_merch_requires_auth(api):
    r = api.get(f"{BASE_URL}/api/admin/merch")
    assert r.status_code == 401


def test_admin_merch_list(api, auth_headers):
    r = api.get(f"{BASE_URL}/api/admin/merch", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_orders_shows_test_session(api, auth_headers, checkout_session):
    r = api.get(f"{BASE_URL}/api/admin/orders", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "count" in data and "items" in data
    sids = [i["session_id"] for i in data["items"]]
    assert checkout_session["session_id"] in sids


# --------- Full CRUD cycle ---------
def test_full_crud_cycle(api, auth_headers):
    # CREATE
    payload = {
        "name": "TEST_Merch_Hoodie",
        "description": "Test hoodie",
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
        "price_cents": 5500,
        "currency": "eur",
        "sizes": ["S", "M", "L"],
        "active": True,
        "order": 99,
    }
    r = api.post(f"{BASE_URL}/api/admin/merch", json=payload, headers=auth_headers)
    assert r.status_code == 200, f"Create failed: {r.text}"
    created = r.json()
    pid = created["id"]
    assert created["stripe_product_id"]
    assert created["stripe_price_id"]
    assert created["lookup_key"].startswith("gm_")
    old_price_id = created["stripe_price_id"]

    # public GET should include it
    r = api.get(f"{BASE_URL}/api/merch")
    assert any(p["id"] == pid for p in r.json())

    # UPDATE price
    payload["price_cents"] = 6500
    r = api.put(f"{BASE_URL}/api/admin/merch/{pid}", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["price_cents"] == 6500
    assert updated["stripe_price_id"] != old_price_id

    # DELETE
    r = api.delete(f"{BASE_URL}/api/admin/merch/{pid}", headers=auth_headers)
    assert r.status_code == 200

    # not in public
    r = api.get(f"{BASE_URL}/api/merch")
    assert not any(p["id"] == pid for p in r.json())
