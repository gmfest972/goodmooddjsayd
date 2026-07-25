"""Iteration 5 tests: empty merch state, newsletter email no-op path, product without sizes."""
import os
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
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


# --- Empty merch state ---
def test_public_merch_empty(api):
    r = api.get(f"{BASE_URL}/api/merch")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert items == [], f"Expected empty merch, got {len(items)} items"


# --- Catalogue unchanged ---
def test_catalogue_9_volumes(api):
    r = api.get(f"{BASE_URL}/api/catalogue")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 9
    for v in items:
        assert v.get("cover_url", "").startswith("http")


def test_tour_seeded(api):
    r = api.get(f"{BASE_URL}/api/tour")
    assert r.status_code == 200
    assert len(r.json()) >= 5


# --- Newsletter: new email should log skip ---
def test_newsletter_new_email_returns_already_false_and_logs_skip(api):
    email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
    r = api.post(f"{BASE_URL}/api/newsletter", json={"email": email, "lang": "fr"})
    assert r.status_code == 200
    data = r.json()
    assert data == {"ok": True, "already": False}
    # allow log flush
    time.sleep(1)
    # grep supervisor logs for the skip message w/ this email
    out = subprocess.run(
        ["bash", "-c",
         f"grep -h 'email skipped' /var/log/supervisor/backend.*.log 2>/dev/null | tail -50"],
        capture_output=True, text=True
    )
    combined = out.stdout
    assert email.lower() in combined.lower(), (
        f"Expected 'email skipped' log line containing {email}. "
        f"Recent skip logs:\n{combined[-2000:]}"
    )


def test_newsletter_duplicate_returns_already_true(api):
    email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
    r1 = api.post(f"{BASE_URL}/api/newsletter", json={"email": email})
    assert r1.status_code == 200 and r1.json()["already"] is False
    r2 = api.post(f"{BASE_URL}/api/newsletter", json={"email": email})
    assert r2.status_code == 200
    assert r2.json() == {"ok": True, "already": True}


# --- Auth ---
def test_admin_login_success(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    assert "token" in r.json()


def test_admin_merch_requires_auth():
    # fresh session without cookies/token
    r = requests.get(f"{BASE_URL}/api/admin/merch")
    assert r.status_code == 401


# --- Product with sizes=[] ---
@pytest.fixture(scope="module")
def created_no_size_product(api, auth_headers):
    payload = {
        "name": "TEST_NoSize_Cap",
        "description": "Test cap without sizes",
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900",
        "price_cents": 2500,
        "currency": "eur",
        "sizes": [],
        "active": True,
        "order": 100,
    }
    r = api.post(f"{BASE_URL}/api/admin/merch", json=payload, headers=auth_headers)
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    doc = r.json()
    yield doc
    # cleanup
    api.delete(f"{BASE_URL}/api/admin/merch/{doc['id']}", headers=auth_headers)


def test_product_with_empty_sizes_persists(api, created_no_size_product):
    doc = created_no_size_product
    assert doc["sizes"] == []
    assert doc["stripe_product_id"]
    assert doc["lookup_key"].startswith("gm_")
    # GET public
    r = api.get(f"{BASE_URL}/api/merch")
    match = next((p for p in r.json() if p["id"] == doc["id"]), None)
    assert match is not None
    assert match["sizes"] == []


def test_product_with_one_size(api, auth_headers):
    payload = {
        "name": "TEST_OneSize_Tote",
        "description": "Single size",
        "image_url": "",
        "price_cents": 1500,
        "currency": "eur",
        "sizes": ["One Size"],
        "active": True,
        "order": 101,
    }
    r = api.post(f"{BASE_URL}/api/admin/merch", json=payload, headers=auth_headers)
    assert r.status_code == 200
    doc = r.json()
    try:
        assert doc["sizes"] == ["One Size"]
        # public
        r2 = api.get(f"{BASE_URL}/api/merch")
        match = next((p for p in r2.json() if p["id"] == doc["id"]), None)
        assert match is not None and match["sizes"] == ["One Size"]
    finally:
        api.delete(f"{BASE_URL}/api/admin/merch/{doc['id']}", headers=auth_headers)


# --- Checkout still works with created product ---
def test_checkout_works_with_no_size_product(api, created_no_size_product):
    r = api.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": created_no_size_product["lookup_key"],
        "quantity": 1,
        "size": "",
        "origin_url": "https://example.com",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["session_id"].startswith("cs_")
    assert data["checkout_url"].startswith("https://checkout.stripe.com/")


def test_checkout_invalid_lookup_404(api):
    r = api.post(f"{BASE_URL}/api/payments/checkout", json={
        "lookup_key": "does_not_exist_xyz",
        "quantity": 1,
        "size": "",
        "origin_url": "https://example.com",
    })
    assert r.status_code == 404


# --- Merch section auto-hide happens client-side; verified in Playwright ---
