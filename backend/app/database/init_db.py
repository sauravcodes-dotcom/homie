"""Create the pgvector extension and all tables.

Run with: python -m app.database.init_db

Fine for the hackathon MVP. Switch to Alembic migrations once the schema
needs to evolve with real data in it.
"""

from sqlalchemy import text

from app import models  # noqa: F401  (registers models on Base.metadata)
from app.database.session import Base, engine


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
