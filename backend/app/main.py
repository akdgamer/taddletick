from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import (
    clients,
    contacts,
    dashboard,
    files,
    google,
    payments,
    projects,
    stage_types,
    stages,
    tasks,
)

app = FastAPI(title="Taddletick")

# Lets the React dev server (a different origin) call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (dashboard, projects, stages, stage_types, clients, contacts, payments, files, tasks, google):
    app.include_router(module.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# In production the built React app is served from here too (one origin, no CORS).
# Mounted last so API routes take precedence.
if settings.frontend_dist and settings.frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
