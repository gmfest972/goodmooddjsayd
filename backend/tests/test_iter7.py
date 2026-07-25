"""Iteration 7 — index.html branding hotfix + iter6 regression."""
import os
import re
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://groove-studio-21.preview.emergentagent.com").rstrip("/")


class TestIndexHtmlBranding:
    def setup_class(cls):
        cls_r = requests.get(f"{BASE_URL}/", timeout=15)
        assert cls_r.status_code == 200
        cls.html = cls_r.text

    def test_title_is_goodmood(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        m = re.search(r"<title>(.*?)</title>", r.text, re.IGNORECASE | re.DOTALL)
        assert m, "no <title> tag"
        title = m.group(1).strip()
        assert "GOOD MOOD" in title and "DJ SAYD" in title, f"unexpected title: {title!r}"
        assert "emergent" not in title.lower(), f"title still contains Emergent: {title!r}"

    def test_meta_description_no_emergent(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', r.text, re.IGNORECASE)
        assert m, "no meta description"
        desc = m.group(1)
        assert "emergent.sh" not in desc.lower()
        assert "emergent" not in desc.lower()
        assert ("GOOD MOOD" in desc) or ("DJ SAYD" in desc)

    def test_og_meta_present(self):
        r = requests.get(f"{BASE_URL}/", timeout=15).text
        assert re.search(r'property=["\']og:title["\']', r)
        assert re.search(r'property=["\']og:description["\']', r)
        assert re.search(r'property=["\']og:type["\']', r)

    def test_favicon_link(self):
        r = requests.get(f"{BASE_URL}/", timeout=15).text
        assert re.search(r'<link[^>]+rel=["\']icon["\'][^>]+href=["\']/logo-gm\.png["\']', r), "favicon link missing"
        fav = requests.get(f"{BASE_URL}/logo-gm.png", timeout=15)
        assert fav.status_code == 200
        assert fav.headers.get("content-type", "").startswith("image/")


class TestIter6Regression:
    def test_catalogue_9_volumes(self):
        r = requests.get(f"{BASE_URL}/api/catalogue", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 9
        for item in data:
            assert item.get("cover_url", "").startswith("http")

    def test_tour_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/tour", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_login(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@goodmood.com", "password": "GoodMood2026"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
