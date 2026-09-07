from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173"]
    database_url: str | None = None
    jwt_secret: str | None = Field(default=None, repr=False)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    demo_staff_password: str | None = Field(default=None, repr=False)
    demo_admin_password: str | None = Field(default=None, repr=False)
    demo_maintenance_admin_password: str | None = Field(default=None, repr=False)


settings = Settings()
