from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    environment: str
    database: Literal["ok", "unavailable"]
    # "temporary" = throwaway SQLite on a serverless host; data resets on restart.
    storage: Literal["postgres", "temporary", "sqlite"]
    auth_mode: Literal["email", "demo"]
    llm_provider: str
    embedding_provider: str
