from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import current_user
from app.config import settings
from app.routers import (
    auth,
    clients,
    contacts,
    dashboard,
    display,
    files,
    google,
    notes,
    payments,
    projects,
    stage_types,
    stages,
    tasks,
    users,
)

app = FastAPI(title="Taddletick")

# Lets the React dev server (a different origin) call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # send the login cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# Login, setup and Google's redirect are open; everything else needs a logged-in user
app.include_router(auth.router)
app.include_router(google.callback_router)
# Checks its own logins: the desk display's limited one, or a person's
app.include_router(display.router)
for module in (
    dashboard, projects, stages, stage_types, clients, contacts, payments, files, notes, tasks, google, users
):
    app.include_router(module.router, dependencies=[Depends(current_user)])


@app.get("/health")
def health():
    return {"status": "ok"}


# In production the built React app is served from here too (one origin, no CORS).
# Mounted last so API routes take precedence.
if settings.frontend_dist and settings.frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
