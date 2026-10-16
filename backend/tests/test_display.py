"""The desk display: pairing, what its limited login may do, and what it shows."""

from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.pair_display import main as make_code
from tests.conftest import TODAY


def pair(capsys, username="boss") -> TestClient:
    make_code(username)
    code = capsys.readouterr().out.strip()
    display = TestClient(app)
    display.__enter__()
    assert display.post("/display/pair", json={"code": code.lower()}).status_code == 204
    # A used code doesn't work twice
    assert TestClient(app).post("/display/pair", json={"code": code}).status_code == 400
    return display


def test_display_login_only_reaches_the_display(client, capsys):
    display = pair(capsys)
    assert display.get("/display/data").status_code == 200
    assert display.get("/dashboard").status_code == 403
    assert display.get("/auth/me").status_code == 403
    assert display.post("/projects", json={"name": "x"}).status_code == 403
    display.__exit__(None, None, None)


def test_wrong_codes_lock_after_five(anon):
    for _ in range(5):
        assert anon.post("/display/pair", json={"code": "AAAA-BBBB"}).status_code == 400
    assert anon.post("/display/pair", json={"code": "AAAA-BBBB"}).status_code == 429


def test_shows_tasks_alerts_and_ticks(client, capsys):
    p = client.post("/projects", json={"name": "Late build", "dispatch_date": "2026-02-20"}).json()
    client.post("/projects", json={"name": "Calm build", "dispatch_date": "2026-04-01"})
    t = client.post("/tasks", json={"title": "Check email", "recurrence": "daily", "start_date": "2026-01-01"}).json()
    display = pair(capsys)

    body = display.get("/display/data").json()
    assert body["name"] == "Boss" and body["active_projects"] == 2
    assert body["alerts"] == [{"project_id": p["id"], "project": "Late build", "flag": "red",
                               "reason": f"Dispatch {(TODAY - date(2026, 2, 20)).days} days late"}]
    assert body["next_dispatch"]["project"] == "Calm build"
    assert [x["title"] for x in body["tasks"]] == ["Check email"] and not body["tasks"][0]["done"]
    assert body["health"]["google"] == "off"

    assert display.post(f"/display/tasks/{t['id']}/done").status_code == 204
    assert display.get("/display/data").json()["tasks"][0]["done"]
    display.__exit__(None, None, None)


def test_unpair_and_password_change_keeps_display(client, capsys):
    display = pair(capsys)
    assert client.get("/display/paired").json() == {"count": 1}
    client.post("/auth/password", json={"current_password": "correct horse", "new_password": "a new password"})
    assert display.get("/display/data").status_code == 200
    assert client.delete("/display/paired").status_code == 204
    assert display.get("/display/data").status_code == 401
    display.__exit__(None, None, None)
