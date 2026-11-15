from datetime import UTC, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import get_settings

EMBEDDING_DIM = get_settings().embedding_dimensions

# Postgres gets JSONB and pgvector; SQLite (demo fallback, tests) gets plain JSON.
JSONType = JSON().with_variant(JSONB(), "postgresql")
EmbeddingType = Vector(EMBEDDING_DIM).with_variant(JSON(), "sqlite")


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
