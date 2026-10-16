"""Guessing protection on login, and the per-project notes log."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.db import SessionLocal
from app.models import LoginFailure
from tests.conftest import PASSWORD


def wrong(c, username="boss"):
    return c.post("/auth/login", json={"username": username, "password": "wrong guess"})


class TestLockout:
    def test_five_wrong_passwords_lock_even_the_right_one_out(self, client):
        client.post("/auth/logout")
        for _ in range(5):
            assert wrong(client).status_code == 401
        r = client.post("/auth/login", json={"username": "boss", "password": PASSWORD})
        assert r.status_code == 429
        assert "15 minutes" in r.json()["detail"]
        assert int(r.headers["Retry-After"]) > 800

    def test_lock_lifts_after_fifteen_minutes(self, client):
        client.post("/auth/logout")
        for _ in range(5):
            wrong(client)
        with SessionLocal() as s:
            s.execute(update(LoginFailure).values(at=datetime.now(timezone.utc) - timedelta(minutes=16)))
            s.commit()
        assert client.post("/auth/login", json={"username": "boss", "password": PASSWORD}).status_code == 200

    def test_success_resets_the_count_and_other_users_are_unaffected(self, client, login_as):
        login_as("Member", "sam")
        client.post("/auth/logout")
        for _ in range(4):
            wrong(client)
        assert client.post("/auth/login", json={"username": "boss", "password": PASSWORD}).status_code == 200
        client.post("/auth/logout")
        for _ in range(4):
            assert wrong(client).status_code == 401  # would be 429 if the earlier four still counted
        for _ in range(5):
            wrong(client, "sam")
        assert client.post("/auth/login", json={"username": "boss", "password": PASSWORD}).status_code == 200

    def test_unknown_usernames_lock_the_same_way(self, anon):
        for _ in range(5):
            assert wrong(anon, "ghost").status_code == 401
        assert wrong(anon, "Ghost").status_code == 429

    def test_password_change_is_limited_too(self, client):
        body = {"current_password": "not it", "new_password": "a brand new one"}
        for _ in range(5):
            assert client.post("/auth/password", json=body).status_code == 400
        assert client.post("/auth/password", json=body | {"current_password": PASSWORD}).status_code == 429


class TestNotes:
    def project(self, client, **fields):
        r = client.post("/projects", json={"name": "Machine", "label": "company", **fields})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def log(self, c, project_id):
        return next(p for p in c.get("/dashboard").json() if p["id"] == project_id)["log"]

    def test_add_and_list_newest_first(self, client):
        pid = self.project(client)
        client.post(f"/projects/{pid}/notes", json={"body": "Kick-off call"})
        r = client.post(f"/projects/{pid}/notes", json={"body": "  Client wants it 50mm higher  "})
        assert r.status_code == 201
        note = r.json()
        assert note["body"] == "Client wants it 50mm higher" and note["author"]["display_name"] == "Boss"
        assert [n["body"] for n in self.log(client, pid)] == ["Client wants it 50mm higher", "Kick-off call"]
        assert client.post(f"/projects/{pid}/notes", json={"body": "   "}).status_code == 422

    def test_only_the_author_rewords_and_deleting_needs_rights(self, client, login_as):
        pid = self.project(client)
        boss_note = client.post(f"/projects/{pid}/notes", json={"body": "From boss"}).json()
        member = login_as("Member")
        mine = member.post(f"/projects/{pid}/notes", json={"body": "From member"}).json()

        assert member.patch(f"/notes/{boss_note['id']}", json={"body": "hijack"}).status_code == 403
        assert member.delete(f"/notes/{boss_note['id']}").status_code == 403  # Member has no delete right
        r = member.patch(f"/notes/{mine['id']}", json={"body": "From member, edited"})
        assert r.status_code == 200 and r.json()["edited_at"] is not None
        assert member.delete(f"/notes/{mine['id']}").status_code == 204  # own note
        assert client.delete(f"/notes/{boss_note['id']}").status_code == 204
        assert self.log(client, pid) == []

    def test_viewers_read_but_cannot_write_and_personal_stays_private(self, client, login_as):
        pid = self.project(client)
        client.post(f"/projects/{pid}/notes", json={"body": "Visible to all"})
        viewer = login_as("Viewer")
        assert [n["body"] for n in self.log(viewer, pid)] == ["Visible to all"]
        assert viewer.post(f"/projects/{pid}/notes", json={"body": "x"}).status_code == 403

        private = self.project(client, name="Mine", label="personal")
        note = client.post(f"/projects/{private}/notes", json={"body": "secret"}).json()
        assert viewer.post(f"/projects/{private}/notes", json={"body": "x"}).status_code == 404
        assert viewer.delete(f"/notes/{note['id']}").status_code == 404
