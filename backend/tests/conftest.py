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
            "TRUNCATE projects, project_stages, project_stage_contacts, contacts, clients RESTART IDENTITY CASCADE"
        ))
        # Keep the seeded catalog, drop anything a test added
        conn.execute(text("DELETE FROM stage_types WHERE sort_order > 11"))


@pytest.fixture
def client():
    app.dependency_overrides[get_today] = lambda: TODAY
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
