from fastapi import APIRouter

from app.core.config import get_settings
from app.database.session import check_database
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness plus dependency status. Returns 200 even if the DB is down."""
    settings = get_settings()
    db_ok = check_database()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        version=settings.app_version,
        environment=settings.environment,
        database="ok" if db_ok else "unavailable",
        llm_provider=settings.llm_provider,
        embedding_provider=settings.embedding_provider,
    )
