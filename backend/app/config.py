from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://tracker:tracker@localhost:5433/tracker"
    # React dev server (Vite default port)
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
