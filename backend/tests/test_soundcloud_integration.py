"""Backend tests for SoundCloud listen_url integration in catalogue."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://groove-studio-21.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def catalogue():
    r = requests.get(f"{BASE_URL}/api/catalogue", timeout=30)
    assert r.status_code == 200, f"catalogue GET failed: {r.status_code} {r.text}"
    return r.json()


class TestCatalogueSoundCloud:
    def test_catalogue_has_9_volumes(self, catalogue):
        assert isinstance(catalogue, list)
        assert len(catalogue) == 9, f"Expected 9 volumes, got {len(catalogue)}"

    def test_vol01_soundcloud_url(self, catalogue):
        v01 = next((v for v in catalogue if v["number"] == "01"), None)
        assert v01 is not None, "Vol 01 missing"
        assert v01.get("listen_url") == "https://soundcloud.com/forss/flickermood", \
            f"Vol 01 listen_url mismatch: {v01.get('listen_url')}"

    def test_vol02_soundcloud_url(self, catalogue):
        v02 = next((v for v in catalogue if v["number"] == "02"), None)
        assert v02 is not None, "Vol 02 missing"
        assert v02.get("listen_url") == "https://soundcloud.com/forss/journeyman", \
            f"Vol 02 listen_url mismatch: {v02.get('listen_url')}"

    def test_other_volumes_empty_listen_url(self, catalogue):
        for v in catalogue:
            if v["number"] not in ("01", "02"):
                assert v.get("listen_url", "") == "", \
                    f"Vol {v['number']} should have empty listen_url, got {v.get('listen_url')}"

    def test_no_mongo_id_leak(self, catalogue):
        for v in catalogue:
            assert "_id" not in v, f"Vol {v.get('number')} leaks _id"

    def test_volumes_have_required_fields(self, catalogue):
        required = {"id", "number", "title", "description", "order"}
        for v in catalogue:
            assert required.issubset(v.keys()), f"Vol {v.get('number')} missing: {required - v.keys()}"


class TestExistingFlowsUnchanged:
    def test_tour_still_returns_5(self):
        r = requests.get(f"{BASE_URL}/api/tour", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_newsletter_still_works(self):
        import uuid
        email = f"TEST_sc_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/newsletter", json={"email": email, "lang": "fr"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("already") is False

    def test_admin_login_still_works(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@goodmood.com", "password": "GoodMood2026"},
                          timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["role"] == "admin"
