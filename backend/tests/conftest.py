import os
from datetime import date

# Must be set before app modules import settings
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://tracker:tracker@localhost:5433/tracker_test"
)

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import engine
from app.main import app
from app.routers.dashboard import get_today

TODAY = date(2026, 3, 1)


def alembic_config() -> Config:
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    return cfg


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    """Build the test schema with the real migrations, so they get tested too."""
    cfg = alembic_config()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE projects, project_stages, project_stage_contacts, contacts, clients, payments, "
            "project_files, tasks, task_completions, synced_items, google_account, project_roles, "
            "user_sessions, users, project_notes, login_failures RESTART IDENTITY CASCADE"
        ))
        # Keep the seeded catalogs (stages, 4 starter roles), drop anything a test added
        conn.execute(text("DELETE FROM stage_types WHERE sort_order > 11"))
        conn.execute(text("DELETE FROM roles WHERE id > 4"))
        conn.execute(text(
            "UPDATE roles SET is_admin = name = 'Admin', can_edit = name IN ('Admin', 'Manager', 'Member'), "
            "can_delete = name = 'Admin', can_view_payments = name IN ('Admin', 'Manager'), "
            "can_edit_payments = name IN ('Admin', 'Manager')"
        ))


ROLE_IDS = {"Admin": 1, "Manager": 2, "Member": 3, "Viewer": 4}
PASSWORD = "correct horse"


@pytest.fixture
def anon():
    """Not logged in."""
    app.dependency_overrides[get_today] = lambda: TODAY
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(anon):
    """Logged in as the first admin (created through the setup screen's endpoint)."""
    r = anon.post("/auth/setup", json={"username": "boss", "display_name": "Boss", "password": PASSWORD})
    assert r.status_code == 201, r.text
    return anon


@pytest.fixture
def login_as(client):
    """login_as("Member") -> a separate logged-in TestClient for a new user with that role."""
    clients = []

    def make(role: str, username: str | None = None) -> TestClient:
        username = username or role.lower()
        r = client.post("/users", json={"username": username, "display_name": username.title(),
                                        "password": PASSWORD, "role_id": ROLE_IDS[role]})
        assert r.status_code == 201, r.text
        c = TestClient(app)
        c.__enter__()
        clients.append(c)
        assert c.post("/auth/login", json={"username": username, "password": PASSWORD}).status_code == 200
        return c

    yield make
    for c in clients:
        c.__exit__(None, None, None)
