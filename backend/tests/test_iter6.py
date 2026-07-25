"""Iteration 6 — tour Stripe ticketing + regression tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://groove-studio-21.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@goodmood.com"
ADMIN_PASSWORD = "GoodMood2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}",
                      "Content-Type": "application/json"})
    return s


# ---------- Regression: public endpoints ----------
def test_catalogue_has_9_with_covers():
    r = requests.get(f"{BASE_URL}/api/catalogue", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 9
    for it in items:
        assert it.get("cover_url", "").startswith("http"), it


def test_tour_public_lists():
    r = requests.get(f"{BASE_URL}/api/tour", timeout=15)
    assert r.status_code == 200
    dates = r.json()
    assert len(dates) >= 5


def test_newsletter_post():
    email = "TEST_iter6_regression@example.com"
    r = requests.post(f"{BASE_URL}/api/newsletter",
                      json={"email": email, "lang": "fr"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ---------- Tour Stripe sync ----------
def test_tour_create_no_price_no_stripe(admin_client):
    payload = {
        "city": "TEST_NoPriceCity", "venue": "Test Venue", "country": "FR",
        "date": "2030-01-01T20:00:00Z", "ticket_url": "https://ex.com/t",
        "status": "available"
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/tour", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["price_cents"] in (None, 0) or d["price_cents"] is None
    assert not d.get("stripe_product_id")
    assert not d.get("stripe_price_id")
    assert not d.get("lookup_key")
    # cleanup
    admin_client.delete(f"{BASE_URL}/api/admin/tour/{d['id']}", timeout=15)


def test_tour_create_with_price_syncs_stripe(admin_client):
    payload = {
        "city": "TEST_PriceCity", "venue": "Test Venue Paid", "country": "FR",
        "date": "2030-02-02T21:00:00Z", "ticket_url": "",
        "status": "available", "price_cents": 2500, "currency": "eur"
    }
    r = admin_client.post(f"{BASE_URL}/api/admin/tour", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["price_cents"] == 2500
    assert d["currency"] == "eur"
    assert d.get("stripe_product_id", "").startswith("prod_")
    assert d.get("stripe_price_id", "").startswith("price_")
    assert d.get("lookup_key", "").startswith("gmt_")

    # Public GET should show this tour
    pr = requests.get(f"{BASE_URL}/api/tour", timeout=15)
    assert pr.status_code == 200
    found = [x for x in pr.json() if x["id"] == d["id"]]
    assert found and found[0].get("lookup_key") == d["lookup_key"]

    # Checkout with lookup_key
    ck = requests.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": d["lookup_key"], "quantity": 1, "variant": "TEST",
        "origin_url": BASE_URL
    }, timeout=20)
    assert ck.status_code == 200, ck.text
    ck_data = ck.json()
    assert "checkout_url" in ck_data
    assert "checkout.stripe.com" in ck_data["checkout_url"] or "stripe.com" in ck_data["checkout_url"]
    assert ck_data.get("session_id", "").startswith("cs_")

    # Update price -> should sync new stripe price
    update = {**payload, "price_cents": 3000}
    ur = admin_client.put(f"{BASE_URL}/api/admin/tour/{d['id']}", json=update, timeout=30)
    assert ur.status_code == 200, ur.text
    ud = ur.json()
    assert ud["price_cents"] == 3000
    assert ud.get("stripe_price_id", "").startswith("price_")
    # cleanup
    admin_client.delete(f"{BASE_URL}/api/admin/tour/{d['id']}", timeout=15)


def test_checkout_bad_lookup_key():
    r = requests.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": "gmt_doesnotexist_xyz", "quantity": 1, "origin_url": BASE_URL
    }, timeout=15)
    assert r.status_code == 404
