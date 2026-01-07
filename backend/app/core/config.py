from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "DocIntel Bench"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://docintel@postgres:5432/docintel"
    redis_url: str = "redis://redis:6379/0"
    storage_backend: str = "local"
    storage_root: Path = Path("/data/documents")
    secret_key: str = ""
    cookie_secure: bool = False
    session_hours: int = Field(default=24, ge=1, le=168)
    allowed_origins: str = "http://localhost:3000,http://localhost:8000"
    max_upload_bytes: int = Field(default=25 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    max_pdf_pages: int = Field(default=30, ge=1, le=100)
    render_dpi: int = Field(default=120, ge=72, le=200)
    max_image_dimension: int = Field(default=1800, ge=512, le=3000)
    max_image_pixels: int = Field(default=30_000_000, ge=1_000_000, le=50_000_000)
    max_run_documents: int = Field(default=100, ge=1, le=1000)
    provider_timeout_seconds: float = Field(default=90, ge=1, le=180)
    job_lease_seconds: int = Field(default=300, ge=60, le=3600)
    job_max_attempts: int = Field(default=4, ge=1, le=10)
    seed_on_register: bool = True
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    webhook_signing_key: str = ""
    webhook_allowed_hosts: str = ""
    webhook_allow_private: bool = False
    s3_bucket: str = ""
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"

    @property
    def origins(self) -> set[str]:
        return {origin.strip().rstrip("/") for origin in self.allowed_origins.split(",")}

    @property
    def webhook_hosts(self) -> set[str]:
        return {host.strip().lower() for host in self.webhook_allowed_hosts.split(",") if host.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
