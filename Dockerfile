# One image for the API, the built React app and the sync worker.
# Builds for whatever machine runs it (arm64 on a Raspberry Pi 4).

FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty API URL: the app calls the API on the same origin it was loaded from
RUN VITE_API_URL= npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project --python-preference only-system
COPY backend/ ./
COPY --from=frontend /frontend/dist /app/frontend-dist
ENV PATH="/app/backend/.venv/bin:$PATH" \
    FRONTEND_DIST=/app/frontend-dist \
    FILES_DIR=/data/files \
    GOOGLE_CLIENT_SECRETS=/secrets/google_client_secret.json \
    FRONTEND_URL=""
EXPOSE 8000
# Apply any pending migrations, then serve
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
