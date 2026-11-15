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
    # Email delivery for login codes. With neither SMTP nor Resend configured,
    # demo mode returns the code in the API response so the flow still works.
    # SMTP defaults to Gmail: set SMTP_USERNAME and SMTP_PASSWORD (an app password).
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_from_address: str | None = None  # defaults to SMTP_USERNAME
    email_from_name: str = "HOMIE"
    resend_api_key: SecretStr | None = None
    email_from: str = "HOMIE <onboarding@resend.dev>"
    auth_demo_mode: bool = True
    # Minimum seconds between two code emails to the same address.
    login_code_cooldown_seconds: int = 30

    # Comma-separated list, e.g. "http://localhost:5173,https://homie.app"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Comma-separated emails allowed to review residency documents.
    admin_emails: str = ""

    # Uploads (listing photos, private residency documents). Local disk; serverless
    # hosts only have /tmp, so production needs object storage for these to persist.
    upload_dir: str | None = None
    max_upload_mb: int = 8

    # Buildings with fewer HOMIE reviews than this show a summary of public reviews.
    min_reviews_for_insights: int = 5
    # "places": official Google Places API (returns at most 5 reviews per place).
    # "serpapi": SerpApi's Google Maps reviews endpoint (paginates, so a 100-review
    # random sample is possible). "none" disables the fallback.
    external_reviews_provider: Literal["none", "places", "serpapi"] = "none"
    external_reviews_sample_size: int = 100
    external_reviews_refresh_days: int = 30
    google_places_api_key: SecretStr | None = None
    serpapi_api_key: SecretStr | None = None

    # AI providers. "mock" needs no API key and is deterministic, which keeps
    # local development, tests and CI free of external calls.
    # "mock" switches to Groq automatically when GROQ_API_KEY is set.
    llm_provider: Literal["mock", "openai", "groq"] = "mock"
    llm_model: str = "gpt-4o-mini"
    embedding_provider: Literal["hashing", "openai"] = "hashing"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = Field(default=384, gt=0)

    openai_api_key: SecretStr | None = None
    # Groq: free tier, OpenAI-compatible API. Only the key is needed.
    groq_api_key: SecretStr | None = None
    # GPT-OSS 120B is on Groq's free developer tier (Llama 3.3 70B became
    # enterprise-only). Override with GROQ_MODEL if Groq's lineup changes.
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
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
    def effective_llm_provider(self) -> str:
        if self.llm_provider == "mock" and self.groq_api_key is not None:
            return "groq"
        return self.llm_provider

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_username) and self.smtp_password is not None

    @property
    def email_delivery_enabled(self) -> bool:
        return self.smtp_configured or self.resend_api_key is not None

    @property
    def upload_root(self) -> str:
        if self.upload_dir:
            return self.upload_dir
        return "/tmp/homie-uploads" if self.vercel else "uploads"

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
