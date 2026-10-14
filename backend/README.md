# Project Tracker API

FastAPI + PostgreSQL backend for the project tracker.

## Run

```sh
# from project-tracker/: start Postgres (host port 5433)
docker compose up -d

# from backend/
uv run alembic upgrade head          # create/upgrade tables, seed stage catalog
uv run uvicorn app.main:app --reload # API on http://localhost:8000, docs at /docs
```

## Test

```sh
uv run pytest   # uses the separate tracker_test database
```

## Layout

- `app/models.py` – tables: `stage_types` (catalog), `projects`, `project_stages`
- `app/urgency.py` – red/amber rules and dashboard ordering (pure functions)
- `app/schemas.py` – JSON shapes the API accepts and returns
- `app/routers/` – endpoints: `/dashboard`, `/projects`, `/stages`, `/stage-types`
- `alembic/versions/` – schema migrations
