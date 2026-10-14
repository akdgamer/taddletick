# Taddletick

Track machine-build and personal projects, their overlapping stages, and what's urgent.

- `backend/` – FastAPI + PostgreSQL API (see backend/README.md)
- `frontend/` – React dashboard (Vite + TypeScript + TanStack Query)

## Run locally

```sh
docker compose up -d                                   # Postgres on port 5433
cd backend && uv run alembic upgrade head              # first run / after schema changes
uv run uvicorn app.main:app --reload                   # API on :8000
cd ../frontend && npm run dev                          # dashboard on http://localhost:5173
```

Tests: `cd backend && uv run pytest` and `cd frontend && npm test`.
