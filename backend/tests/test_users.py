"""Logins, roles and who can see or change what."""

from datetime import date

from app.models import Project, ProjectLabel, User
from app import auth
from tests.conftest import PASSWORD, ROLE_IDS


def company(client, **fields):
    r = client.post("/projects", json={"name": "Machine", "label": "company", **fields})
    assert r.status_code == 201, r.text
    return r.json()


class TestLogin:
    def test_everything_needs_login(self, anon):
        assert anon.get("/dashboard").status_code == 401
        assert anon.get("/files/1").status_code == 401
        assert anon.get("/health").status_code == 200

    def test_setup_only_once(self, anon):
        assert anon.get("/auth/setup").json() == {"needed": True}
        body = {"username": "boss", "display_name": "Boss", "password": PASSWORD}
        assert anon.post("/auth/setup", json=body).status_code == 201
        assert anon.get("/auth/setup").json() == {"needed": False}
        assert anon.post("/auth/setup", json=body | {"username": "other"}).status_code == 409

    def test_setup_claims_data_from_before_users(self, anon):
        from app.db import SessionLocal
        from app.models import Task

        with SessionLocal() as s:
            s.add(Project(name="Old personal", label=ProjectLabel.personal))
            s.add(Task(title="Old task", start_date=date(2026, 3, 1)))
            s.commit()
        anon.post("/auth/setup", json={"username": "boss", "display_name": "Boss", "password": PASSWORD})
        assert [p["name"] for p in anon.get("/dashboard").json()] == ["Old personal"]
        assert [t["title"] for t in anon.get("/tasks").json()] == ["Old task"]

    def test_login_logout_and_wrong_password(self, client, anon):
        client.post("/auth/logout")
        assert client.get("/auth/me").status_code == 401
        assert client.post("/auth/login", json={"username": "BOSS", "password": "nope"}).status_code == 401
        assert client.post("/auth/login", json={"username": "nobody", "password": PASSWORD}).status_code == 401
        r = client.post("/auth/login", json={"username": "BOSS", "password": PASSWORD})  # username ignores case
        assert r.status_code == 200 and r.json()["role"]["is_admin"]

    def test_password_is_hashed(self):
        stored = auth.hash_password("secret pass")
        assert "secret" not in stored
        assert auth.check_password("secret pass", stored)
        assert not auth.check_password("Secret pass", stored)

    def test_change_password_logs_out_other_browsers(self, login_as):
        phone = login_as("Member", "sam")
        from fastapi.testclient import TestClient
        from app.main import app

        with TestClient(app) as laptop:
            laptop.post("/auth/login", json={"username": "sam", "password": PASSWORD})
            assert phone.post("/auth/password", json={"current_password": "wrong", "new_password": "new password"}).status_code == 400
            assert phone.post("/auth/password", json={"current_password": PASSWORD, "new_password": "new password"}).status_code == 204
            assert phone.get("/auth/me").status_code == 200
            assert laptop.get("/auth/me").status_code == 401

    def test_deactivated_user_is_logged_out(self, client, login_as):
        sam = login_as("Member", "sam")
        user_id = sam.get("/auth/me").json()["id"]
        assert client.patch(f"/users/{user_id}", json={"is_active": False}).status_code == 200
        assert sam.get("/dashboard").status_code == 401
        assert sam.post("/auth/login", json={"username": "sam", "password": PASSWORD}).status_code == 401


class TestVisibility:
    def test_personal_projects_are_private_even_from_admins(self, client, login_as):
        sam = login_as("Member", "sam")
        mine = sam.post("/projects", json={"name": "Sam's", "label": "personal"}).json()
        assert [p["name"] for p in sam.get("/dashboard").json()] == ["Sam's"]
        assert client.get("/dashboard").json() == []
        assert client.get(f"/projects/{mine['id']}").status_code == 404
        assert client.delete(f"/projects/{mine['id']}").status_code == 404

    def test_viewer_can_keep_personal_projects_but_not_company_ones(self, login_as):
        viewer = login_as("Viewer")
        assert viewer.post("/projects", json={"name": "Mine", "label": "personal"}).status_code == 201
        assert viewer.post("/projects", json={"name": "Shared", "label": "company"}).status_code == 403

    def test_restricted_projects(self, client, login_as):
        member, manager = login_as("Member"), login_as("Manager")
        secret = company(client, name="Secret", allowed_role_ids=[ROLE_IDS["Manager"]])
        company(client, name="Open")
        assert [p["name"] for p in member.get("/dashboard").json()] == ["Open"]
        assert member.get(f"/projects/{secret['id']}").status_code == 404
        assert {p["name"] for p in manager.get("/dashboard").json()} == {"Secret", "Open"}
        assert {p["name"] for p in client.get("/dashboard").json()} == {"Secret", "Open"}

    def test_only_admins_restrict_projects(self, client, login_as):
        manager = login_as("Manager")
        assert manager.post("/projects", json={"name": "X", "allowed_role_ids": [2]}).status_code == 403
        p = company(manager)
        assert manager.patch(f"/projects/{p['id']}", json={"allowed_role_ids": [2]}).status_code == 403
        assert client.patch(f"/projects/{p['id']}", json={"allowed_role_ids": [2]}).json()["allowed_role_ids"] == [2]

    def test_only_creator_can_make_project_personal(self, client, login_as):
        manager = login_as("Manager")
        p = company(client)
        assert manager.patch(f"/projects/{p['id']}", json={"label": "personal"}).status_code == 403
        assert client.patch(f"/projects/{p['id']}", json={"label": "personal"}).status_code == 200
        assert manager.get("/dashboard").json() == []

    def test_restricted_project_hides_its_files_tasks_and_stages(self, client, login_as):
        member = login_as("Member")
        p = company(client, stage_type_ids=[1], allowed_role_ids=[ROLE_IDS["Manager"]])
        file_id = client.post(f"/projects/{p['id']}/files", files={"upload": ("a.txt", b"hi")}).json()["id"]
        assert member.get(f"/files/{file_id}").status_code == 404
        assert member.patch(f"/stages/{p['stages'][0]['id']}", json={"notes": "x"}).status_code == 404
        assert member.post("/tasks", json={"title": "t", "project_id": p["id"]}).status_code == 422


class TestPermissions:
    def test_member_edits_but_does_not_delete(self, client, login_as):
        member = login_as("Member")
        p = company(client, stage_type_ids=[1, 2])
        stage_id = p["stages"][0]["id"]
        assert member.patch(f"/projects/{p['id']}", json={"notes": "updated"}).status_code == 200
        assert member.patch(f"/stages/{stage_id}", json={"status": "done"}).status_code == 200
        assert member.delete(f"/stages/{stage_id}").status_code == 403
        assert member.delete(f"/projects/{p['id']}").status_code == 403
        assert member.post("/clients", json={"name": "Acme"}).status_code == 201
        client_id = member.get("/clients").json()[0]["id"]
        assert member.delete(f"/clients/{client_id}").status_code == 403
        assert client.delete(f"/projects/{p['id']}").status_code == 204

    def test_viewer_cannot_change_company_projects(self, client, login_as):
        viewer = login_as("Viewer")
        p = company(client, stage_type_ids=[1])
        view = viewer.get(f"/projects/{p['id']}").json()
        assert view["access"] == {"can_edit": False, "can_delete": False,
                                  "can_view_payments": False, "can_edit_payments": False}
        assert viewer.patch(f"/projects/{p['id']}", json={"notes": "x"}).status_code == 403
        assert viewer.patch(f"/stages/{p['stages'][0]['id']}", json={"notes": "x"}).status_code == 403
        assert viewer.post(f"/projects/{p['id']}/files", files={"upload": ("a.txt", b"hi")}).status_code == 403
        assert viewer.post("/contacts", json={"name": "Priya"}).status_code == 403

    def test_payments_hidden_from_roles_without_payment_access(self, client, login_as):
        member, manager = login_as("Member"), login_as("Manager")
        p = company(client)
        pay = client.post(f"/projects/{p['id']}/payments",
                          json={"label": "Advance", "expected_amount": 100, "due_date": "2026-02-01"}).json()
        # Overdue payment: red for those who can see it, invisible (and not red) for others
        assert client.get("/dashboard").json()[0]["flag"] == "red"
        assert member.get("/dashboard").json()[0]["flag"] == "none"
        assert member.get("/dashboard").json()[0]["payments"] == []
        assert member.get(f"/projects/{p['id']}").json()["payments"] == []
        assert member.get("/payments/outstanding").json() == []
        assert member.patch(f"/payments/{pay['id']}", json={"received_amount": 100}).status_code == 404
        assert member.post(f"/projects/{p['id']}/payments", json={"label": "x", "expected_amount": 1}).status_code == 403
        # Managers see and record payments but can't delete them
        assert len(manager.get("/payments/outstanding").json()) == 1
        assert manager.patch(f"/payments/{pay['id']}", json={"received_amount": 100}).status_code == 200
        assert manager.delete(f"/payments/{pay['id']}").status_code == 403

    def test_owner_has_full_rights_on_personal_projects(self, login_as):
        viewer = login_as("Viewer")
        p = viewer.post("/projects", json={"name": "Mine", "label": "personal", "stage_type_ids": [1]}).json()
        assert p["access"] == {"can_edit": True, "can_delete": True,
                               "can_view_payments": True, "can_edit_payments": True}
        assert viewer.post(f"/projects/{p['id']}/payments", json={"label": "x", "expected_amount": 1}).status_code == 201
        assert viewer.delete(f"/projects/{p['id']}").status_code == 204


class TestTasks:
    def test_each_user_has_their_own_tasks(self, client, login_as):
        sam = login_as("Member", "sam")
        task = client.post("/tasks", json={"title": "Boss task"}).json()
        sam.post("/tasks", json={"title": "Sam task"})
        assert [t["title"] for t in client.get("/tasks/today").json()] == ["Boss task"]
        assert [t["title"] for t in sam.get("/tasks").json()] == ["Sam task"]
        assert sam.post(f"/tasks/{task['id']}/done").status_code == 404
        assert sam.delete(f"/tasks/{task['id']}").status_code == 404


class TestUserAdmin:
    def test_only_admins_manage_users_and_roles(self, login_as):
        manager = login_as("Manager")
        assert manager.get("/users").status_code == 403
        assert manager.post("/roles", json={"name": "X"}).status_code == 403
        assert len(manager.get("/roles").json()) == 4  # listing is fine (for project restrictions)

    def test_usernames_unique_ignoring_case(self, client):
        body = {"username": "Sam", "display_name": "Sam", "password": PASSWORD, "role_id": 3}
        assert client.post("/users", json=body).status_code == 201
        assert client.post("/users", json=body | {"username": "sam"}).status_code == 409

    def test_cannot_lock_everyone_out(self, client):
        me = client.get("/auth/me").json()
        assert client.patch(f"/users/{me['id']}", json={"is_active": False}).status_code == 409
        assert client.patch(f"/users/{me['id']}", json={"role_id": 3}).status_code == 409
        assert client.patch(f"/roles/{ROLE_IDS['Admin']}", json={"is_admin": False}).status_code == 409
        assert client.get("/auth/me").json()["role"]["is_admin"]

    def test_custom_role_and_delete(self, client):
        role = client.post("/roles", json={"name": "Accounts", "can_view_payments": True}).json()
        user = client.post("/users", json={"username": "acc", "display_name": "Acc", "password": PASSWORD,
                                           "role_id": role["id"]}).json()
        assert client.delete(f"/roles/{role['id']}").status_code == 409
        client.patch(f"/users/{user['id']}", json={"role_id": ROLE_IDS["Viewer"]})
        assert client.delete(f"/roles/{role['id']}").status_code == 204


def test_google_events_respect_visibility(client, login_as):
    from app.db import SessionLocal
    from app import google_sync

    member = login_as("Member", "sam")
    p = company(client, dispatch_date="2026-04-01")
    client.post(f"/projects/{p['id']}/payments", json={"label": "Advance", "expected_amount": 5, "due_date": "2026-03-10"})
    company(client, name="Secret", dispatch_date="2026-04-02", allowed_role_ids=[ROLE_IDS["Manager"]])
    member.post("/projects", json={"name": "Sam's", "label": "personal", "dispatch_date": "2026-04-03"})
    with SessionLocal() as s:
        boss, sam = s.get(User, 1), s.get(User, 2)
        assert sorted(google_sync.desired_events(s, boss)) == [
            f"calendar:dispatch:{p['id']}", f"calendar:dispatch:{p['id'] + 1}", "calendar:payment:1"]
        assert sorted(google_sync.desired_events(s, sam)) == [
            f"calendar:dispatch:{p['id']}", f"calendar:dispatch:{p['id'] + 2}"]
