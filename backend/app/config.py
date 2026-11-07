from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BIODRY_", case_sensitive=False)

    database_url: str | None = None
    database_driver: str = "postgresql+psycopg"
    database_host: str | None = None
    database_port: int = Field(default=5432, ge=1, le=65535)
    database_name: str = "biodry"
    database_user: str = "biodry"
    database_password: str | None = None
    frontend_origin: str = "http://localhost:3000"
    session_cookie_name: str = "biodry-db-session"
    csrf_cookie_name: str = "biodry-csrf"
    session_hours: int = Field(default=8, ge=1, le=168)
    cookie_secure: bool = False
    login_attempt_limit: int = Field(default=5, ge=3, le=20)
    login_window_minutes: int = Field(default=15, ge=1, le=120)
    staff_edit_window_hours: int = Field(default=24, ge=1, le=168)
    environment: str = "local"

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        if not self.database_host:
            return "sqlite:///./biodry.db"
        return URL.create(
            drivername=self.database_driver,
            username=self.database_user,
            password=self.database_password,
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()

