"""Create tables (and the pgvector extension on Postgres).

Run with: python -m app.database.init_db

The app also calls `init_db()` on startup so a fresh database works without
a manual step. Switch to Alembic migrations once real data exists.
"""

import logging

from sqlalchemy import text

from app import models  # noqa: F401  (registers models on Base.metadata)
from app.database.session import Base, engine

logger = logging.getLogger("homie")


def init_db() -> None:
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
