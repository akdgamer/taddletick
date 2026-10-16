from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://tracker:tracker@localhost:5433/tracker"
    # React dev server (Vite default port)
    cors_origins: list[str] = ["http://localhost:5173"]

    # Where uploaded project files are stored (a NAS mount on the Pi)
    files_dir: Path = Path(__file__).resolve().parents[2] / "data" / "files"

    # Built frontend to serve from the API in production; unset in development
    frontend_dist: Path | None = None
    # Where the browser is sent back to after connecting Google
    frontend_url: str = "http://localhost:5173"

    # Google OAuth client (a "Web application" client from Google Cloud console)
    google_client_secrets: Path = Path(__file__).resolve().parents[2] / "secrets" / "google_client_secret.json"
    google_redirect_uri: str = "http://localhost:8000/google/callback"

    # Login cookie: Secure (HTTPS only) in production behind Tailscale; off for http://localhost
    cookie_secure: bool = False
    session_days: int = 60

    # Nightly database dumps (read-only in the app, for the desk display's "last backup")
    backup_dir: Path | None = None

    # How often the worker pushes changes to Google
    sync_interval_seconds: int = 300


settings = Settings()
