# Taddletick

Track machine-build and personal projects: overlapping stages, deadlines, the
people involved, payments, files, and daily tasks, with deadlines mirrored to
Google Calendar and tasks to Google Tasks.

- `backend/` – FastAPI + PostgreSQL API, Google sync worker (see backend/README.md)
- `frontend/` – React dashboard (Vite + TypeScript + TanStack Query)
- `DEPLOY.md` – running it on a Raspberry Pi with Tailscale and a NAS

## Run locally (development)

```sh
docker compose up -d                                   # Postgres on port 5433
cd backend && uv run alembic upgrade head              # first run / after schema changes
uv run uvicorn app.main:app --reload                   # API on :8000
uv run python -m app.worker                            # optional: Google sync loop
cd ../frontend && npm run dev                          # dashboard on http://localhost:5173
```

The first visit shows a "Create the admin account" screen. That account takes over
everything created before there were users; add other people under **Users**.

Uploaded files go to `data/files/`. Google sync needs `secrets/google_client_secret.json`
(see DEPLOY.md, step 7; use the `http://localhost:8000/google/callback` redirect URI).

Tests: `cd backend && uv run pytest` and `cd frontend && npm test`.
