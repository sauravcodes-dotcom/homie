"""Application settings, loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "HOMIE API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "production"] = "development"

    # When unset: local Postgres in development, and a throwaway SQLite file
    # on serverless hosts (VERCEL=1) so the demo works before a real DB exists.
    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")
    vercel: bool = False
    seed_demo_data: bool = True
    demo_listing_count: int = Field(default=3000, ge=0, le=20000)

    # Auth. Only addresses at this exact domain may sign in.
    allowed_email_domain: str = "usc.edu"
    secret_key: SecretStr = SecretStr("dev-only-change-me")
    login_code_ttl_minutes: int = 10
    login_code_max_attempts: int = 5
    session_days: int = 30
    # Email delivery for login codes. Without a key, demo mode returns the
    # code in the API response so the flow can be shown end to end.
    resend_api_key: SecretStr | None = None
    email_from: str = "HOMIE <onboarding@resend.dev>"
    auth_demo_mode: bool = True

    # Comma-separated list, e.g. "http://localhost:5173,https://homie.app"
    cors_origins: str = "http://localhost:5173"

    # AI providers. "mock" needs no API key and is deterministic, which keeps
    # local development, tests and CI free of external calls.
    llm_provider: Literal["mock", "openai"] = "mock"
    llm_model: str = "gpt-4o-mini"
    embedding_provider: Literal["hashing", "openai"] = "hashing"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = Field(default=384, gt=0)

    openai_api_key: SecretStr | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    ai_request_timeout_seconds: float = 30.0

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            url = self.database_url_override
            # Hosted providers hand out postgres:// URLs; use the psycopg 3 driver.
            for prefix in ("postgres://", "postgresql://"):
                if url.startswith(prefix):
                    return "postgresql+psycopg://" + url[len(prefix) :]
            return url
        if self.vercel:
            return "sqlite:////tmp/homie.db"
        return "postgresql+psycopg://homie:homie@localhost:5432/homie"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def email_delivery_enabled(self) -> bool:
        return self.resend_api_key is not None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
