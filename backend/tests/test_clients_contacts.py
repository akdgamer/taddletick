from alembic import command
from sqlalchemy import text

from app.db import engine
from tests.conftest import alembic_config


def make_client(client, name="Acme", **fields):
    response = client.post("/clients", json={"name": name} | fields)
    assert response.status_code == 201, response.text
    return response.json()


def make_contact(client, name="Priya", **fields):
    response = client.post("/contacts", json={"name": name} | fields)
    assert response.status_code == 201, response.text
    return response.json()


class TestClients:
    def test_create_and_list_with_contacts(self, client):
        acme = make_client(client, address="Pune")
        make_contact(client, "Zed", client_id=acme["id"])
        make_contact(client, "Amit", client_id=acme["id"], role="Purchase")

        clients = client.get("/clients").json()
        assert [c["name"] for c in clients] == ["Acme"]
        assert [c["name"] for c in clients[0]["contacts"]] == ["Amit", "Zed"]

    def test_names_unique_ignoring_case(self, client):
        make_client(client, "Acme")
        assert client.post("/clients", json={"name": " acme "}).status_code == 409
        beta = make_client(client, "Beta")
        assert client.patch(f"/clients/{beta['id']}", json={"name": "ACME"}).status_code == 409
        # Renaming to its own name (different case) is fine
        assert client.patch(f"/clients/{beta['id']}", json={"name": "BETA"}).status_code == 200

    def test_delete_refused_while_in_use(self, client):
        acme = make_client(client)
        contact = make_contact(client, client_id=acme["id"])
        project = client.post("/projects", json={"name": "Press", "client_id": acme["id"]}).json()

        response = client.delete(f"/clients/{acme['id']}")
        assert response.status_code == 409
        assert "1 project(s) and 1 contact(s)" in response.json()["detail"]

        client.delete(f"/projects/{project['id']}")
        client.delete(f"/contacts/{contact['id']}")
        assert client.delete(f"/clients/{acme['id']}").status_code == 204


class TestContacts:
    def test_contact_without_client(self, client):
        supplier = make_contact(client, "Ravi", role="Valve supplier", phone="+91 98")
        assert supplier["client"] is None
        assert supplier["phone"] == "+91 98"

    def test_unknown_client_rejected(self, client):
        assert client.post("/contacts", json={"name": "X", "client_id": 999}).status_code == 422

    def test_search_by_name_role_or_company(self, client):
        acme = make_client(client, "Acme")
        make_contact(client, "Priya Shah", client_id=acme["id"], role="Engineer")
        make_contact(client, "Ravi", role="Supplier")

        def search(q):
            return [c["name"] for c in client.get("/contacts", params={"q": q}).json()]

        assert search("priya") == ["Priya Shah"]
        assert search("supp") == ["Ravi"]
        assert search("acme") == ["Priya Shah"]
        assert search("") == ["Priya Shah", "Ravi"]
        # Every word must match, but each can match a different field
        assert search("priya acme") == ["Priya Shah"]
        assert search("ravi acme") == []

    def test_move_contact_between_clients(self, client):
        acme, beta = make_client(client, "Acme"), make_client(client, "Beta")
        contact = make_contact(client, client_id=acme["id"])
        moved = client.patch(f"/contacts/{contact['id']}", json={"client_id": beta["id"]}).json()
        assert moved["client"]["name"] == "Beta"
        cleared = client.patch(f"/contacts/{contact['id']}", json={"client_id": None}).json()
        assert cleared["client"] is None


class TestProjectClient:
    def test_project_links_to_client(self, client):
        acme = make_client(client)
        project = client.post("/projects", json={"name": "Press", "client_id": acme["id"]}).json()
        assert project["client"] == {"id": acme["id"], "name": "Acme"}
        assert client.get("/dashboard").json()[0]["client"]["name"] == "Acme"

    def test_change_and_clear_project_client(self, client):
        acme, beta = make_client(client, "Acme"), make_client(client, "Beta")
        project = client.post("/projects", json={"name": "Press", "client_id": acme["id"]}).json()
        updated = client.patch(f"/projects/{project['id']}", json={"client_id": beta["id"]}).json()
        assert updated["client"]["name"] == "Beta"
        cleared = client.patch(f"/projects/{project['id']}", json={"client_id": None}).json()
        assert cleared["client"] is None

    def test_unknown_client_rejected(self, client):
        assert client.post("/projects", json={"name": "x", "client_id": 999}).status_code == 422


class TestStakeholders:
    def test_add_and_remove_stage_contacts(self, client):
        project = client.post("/projects", json={"name": "Press", "stage_type_ids": [5]}).json()
        stage_id = project["stages"][0]["id"]
        ravi = make_contact(client, "Ravi", email="ravi@example.com")
        amit = make_contact(client, "Amit")

        client.post(f"/stages/{stage_id}/contacts/{ravi['id']}")
        client.post(f"/stages/{stage_id}/contacts/{ravi['id']}")  # twice is harmless
        stage = client.post(f"/stages/{stage_id}/contacts/{amit['id']}").json()
        assert [c["name"] for c in stage["contacts"]] == ["Amit", "Ravi"]

        tile = client.get("/dashboard").json()[0]
        assert tile["stages"][0]["contacts"][1]["email"] == "ravi@example.com"

        stage = client.delete(f"/stages/{stage_id}/contacts/{amit['id']}").json()
        assert [c["name"] for c in stage["contacts"]] == ["Ravi"]

    def test_deleting_contact_removes_it_from_stages(self, client):
        project = client.post("/projects", json={"name": "Press", "stage_type_ids": [5]}).json()
        stage_id = project["stages"][0]["id"]
        ravi = make_contact(client, "Ravi")
        client.post(f"/stages/{stage_id}/contacts/{ravi['id']}")

        client.delete(f"/contacts/{ravi['id']}")
        assert client.get(f"/projects/{project['id']}").json()["stages"][0]["contacts"] == []

    def test_unknown_contact(self, client):
        project = client.post("/projects", json={"name": "Press", "stage_type_ids": [5]}).json()
        assert client.post(f"/stages/{project['stages'][0]['id']}/contacts/999").status_code == 404


def test_migration_turns_client_names_into_clients():
    """Old free-text client names become client records linked to their projects."""
    cfg = alembic_config()
    command.downgrade(cfg, "d2003b6c64f9")
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO projects (name, client_name, label, is_p0, notes, is_completed) VALUES
                ('A', 'Acme', 'company', false, '', false),
                ('B', ' acme ', 'company', false, '', false),
                ('C', 'Beta', 'company', false, '', false),
                ('D', NULL, 'company', false, '', false),
                ('E', '  ', 'company', false, '', false)
            """))
        command.upgrade(cfg, "head")
        with engine.connect() as conn:
            clients = conn.execute(text("SELECT name FROM clients ORDER BY name")).scalars().all()
            links = dict(conn.execute(text("""
                SELECT p.name, c.name FROM projects p LEFT JOIN clients c ON c.id = p.client_id
            """)).all())
        assert clients == ["Acme", "Beta"]
        assert links == {"A": "Acme", "B": "Acme", "C": "Beta", "D": None, "E": None}
    finally:
        command.upgrade(cfg, "head")
