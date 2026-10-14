from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import clients, contacts, dashboard, projects, stage_types, stages

app = FastAPI(title="Project Tracker")

# Lets the React dev server (a different origin) call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(projects.router)
app.include_router(stages.router)
app.include_router(stage_types.router)
app.include_router(clients.router)
app.include_router(contacts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
