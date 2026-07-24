"""Iteration 3 backend tests: real GOOD MOOD catalogue (9 volumes)
with real titles, years, plays, sc_track (0-8), and shared SC playlist URL.
Also verifies admin PUT accepts year/plays/sc_track fields.
"""
import os
import uuid
import pytest
import requests

from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
except Exception:
    pass
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PLAYLIST_URL = "https://soundcloud.com/s-yd-l-ma-li/sets/good-mood-by-dj-sayd"

EXPECTED = {
    "01": {"title": "GOOD MOOD",        "year": "2017", "sc_track": 0},
    "02": {"title": "GOOD MOOD VOL. 2", "year": "2018", "sc_track": 1},
    "03": {"title": "NWARLAND PARTY",   "year": "2018", "sc_track": 2},
    "04": {"title": "REMEMBER",         "year": "2020", "sc_track": 3},
    "05": {"title": "NWARLAND PT.2",    "year": "2020", "sc_track": 4},
    "06": {"title": "VIE DE CÉSAR",     "year": "2021", "sc_track": 5},
    "07": {"title": "GOOD MOOD VOL. 7", "year": "2022", "sc_track": 6},
    "08": {"title": "LIVE BIRTHDAY",    "year": "2022", "sc_track": 7, "plays": "530K"},
    "09": {"title": "SUMMER BABY",      "year": "2022", "sc_track": 8},
}


@pytest.fixture(scope="module")
def catalogue():
    r = requests.get(f"{BASE_URL}/api/catalogue", timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@goodmood.com", "password": "GoodMood2026"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


class TestCatalogueRealData:
    def test_nine_volumes(self, catalogue):
        assert len(catalogue) == 9

    def test_no_mongo_id(self, catalogue):
        for v in catalogue:
            assert "_id" not in v

    @pytest.mark.parametrize("number", list(EXPECTED.keys()))
    def test_volume_real_metadata(self, catalogue, number):
        v = next((x for x in catalogue if x["number"] == number), None)
        assert v is not None, f"Vol {number} missing"
        exp = EXPECTED[number]
        assert v["title"] == exp["title"], f"Vol {number} title = {v['title']!r}"
        assert v.get("year") == exp["year"], f"Vol {number} year = {v.get('year')!r}"
        assert v.get("sc_track") == exp["sc_track"], f"Vol {number} sc_track = {v.get('sc_track')!r}"
        assert v.get("listen_url") == PLAYLIST_URL, f"Vol {number} listen_url = {v.get('listen_url')!r}"

    def test_vol08_plays_530k(self, catalogue):
        v = next(x for x in catalogue if x["number"] == "08")
        assert v.get("plays") == "530K"

    def test_all_have_plays_field_present(self, catalogue):
        # plays field must exist (may be empty string for vol 01)
        for v in catalogue:
            assert "plays" in v


class TestAdminCRUDAcceptsNewFields:
    def _headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_put_accepts_year_plays_sc_track(self, admin_token):
        # create a temp volume
        payload = {
            "number": f"TEST-{uuid.uuid4().hex[:6]}",
            "title": "TEST_VOL",
            "year": "2099",
            "plays": "1.2K",
            "sc_track": 3,
            "listen_url": PLAYLIST_URL,
            "order": 999,
        }
        r = requests.post(f"{BASE_URL}/api/admin/catalogue", json=payload,
                          headers=self._headers(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        created = r.json()
        vid = created["id"]
        try:
            assert created["year"] == "2099"
            assert created["plays"] == "1.2K"
            assert created["sc_track"] == 3

            # PUT update
            payload.update({"year": "2100", "plays": "9.9K", "sc_track": 5,
                            "title": "TEST_VOL_UPDATED"})
            r2 = requests.put(f"{BASE_URL}/api/admin/catalogue/{vid}", json=payload,
                              headers=self._headers(admin_token), timeout=30)
            assert r2.status_code == 200, r2.text
            updated = r2.json()
            assert updated["year"] == "2100"
            assert updated["plays"] == "9.9K"
            assert updated["sc_track"] == 5
            assert updated["title"] == "TEST_VOL_UPDATED"

            # verify GET reflects changes
            r3 = requests.get(f"{BASE_URL}/api/admin/catalogue",
                              headers=self._headers(admin_token), timeout=30)
            assert r3.status_code == 200
            match = next((x for x in r3.json() if x["id"] == vid), None)
            assert match and match["year"] == "2100" and match["sc_track"] == 5
        finally:
            requests.delete(f"{BASE_URL}/api/admin/catalogue/{vid}",
                            headers=self._headers(admin_token), timeout=30)


class TestExistingFlowsUnchanged:
    def test_tour_returns_5(self):
        r = requests.get(f"{BASE_URL}/api/tour", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_newsletter_post(self):
        email = f"TEST_iter3_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/newsletter",
                          json={"email": email, "lang": "fr"}, timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@goodmood.com", "password": "GoodMood2026"},
                          timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"
