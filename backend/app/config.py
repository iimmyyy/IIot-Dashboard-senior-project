from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BIODRY_", case_sensitive=False)

    database_url: str = "sqlite:///./biodry.db"
    frontend_origin: str = "http://localhost:3000"
    session_cookie_name: str = "biodry-db-session"
    csrf_cookie_name: str = "biodry-csrf"
    session_hours: int = Field(default=8, ge=1, le=168)
    cookie_secure: bool = False
    login_attempt_limit: int = Field(default=5, ge=3, le=20)
    login_window_minutes: int = Field(default=15, ge=1, le=120)
    environment: str = "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()

