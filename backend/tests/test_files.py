"""Previews: what opens in the browser (safely), what always downloads, and photo thumbnails."""

import io

import pytest
from PIL import Image

from app.config import settings


@pytest.fixture(autouse=True)
def files_in_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "files_dir", tmp_path)


def upload(client, name, data, content_type):
    p = client.post("/projects", json={"name": "Press"}).json()
    r = client.post(f"/projects/{p['id']}/files", files={"upload": (name, data, content_type)})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def png(width, height) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(out, "PNG")
    return out.getvalue()


def test_photos_get_a_small_thumbnail(client):
    file_id = upload(client, "site.png", png(2000, 1000), "image/png")
    r = client.get(f"/files/{file_id}/thumbnail")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp"
    assert Image.open(io.BytesIO(r.content)).size == (480, 240)
    assert client.get(f"/files/{file_id}/thumbnail").content == r.content  # served from the kept copy


def test_safe_types_open_in_the_browser_locked_down(client):
    pdf = upload(client, "drawing.pdf", b"%PDF-1.4 ...", "application/pdf")
    r = client.get(f"/files/{pdf}")
    assert r.headers["content-disposition"].startswith("inline")
    assert "content-security-policy" not in r.headers  # the browser's PDF viewer needs to run

    text = upload(client, "notes.csv", b"a,b\n1,2", "text/csv")
    r = client.get(f"/files/{text}")
    assert r.headers["content-type"] == "text/plain; charset=utf-8"
    assert r.headers["content-security-policy"].startswith("sandbox")
    assert r.headers["x-content-type-options"] == "nosniff"


def test_html_and_svg_always_download(client):
    for name, kind in (("page.html", "text/html"), ("logo.svg", "image/svg+xml")):
        file_id = upload(client, name, b"<script>alert(1)</script>", kind)
        r = client.get(f"/files/{file_id}")
        assert r.headers["content-disposition"].startswith("attachment")
        assert r.headers["content-type"] == "application/octet-stream"
        assert client.get(f"/files/{file_id}/thumbnail").status_code == 404


def test_download_link_forces_a_download(client):
    file_id = upload(client, "site.png", png(10, 10), "image/png")
    assert client.get(f"/files/{file_id}", params={"download": 1}).headers["content-disposition"].startswith("attachment")


def test_unlabelled_uploads_are_typed_by_extension(client):
    file_id = upload(client, "parts.csv", b"a,b", "application/octet-stream")
    assert client.get(f"/files/{file_id}").headers["content-type"] == "text/plain; charset=utf-8"
