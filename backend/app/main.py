import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.services import storage

logger = logging.getLogger("homie")


def prepare_database() -> None:
    """Create tables and seed demo data. Never blocks startup if the DB is down."""
    from app.database.init_db import init_db
    from app.database.seed import seed_demo_data
    from app.database.session import SessionLocal

    try:
        init_db()
        if get_settings().seed_demo_data:
            with SessionLocal() as db:
                seed_demo_data(db)
    except Exception:
        logger.warning("Database not ready; continuing without it", exc_info=True)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    prepare_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI-powered student housing network. Find your place. Find your people.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    # Listing photos are public. Residency documents live elsewhere and are not served here.
    app.mount("/api/uploads/photos", StaticFiles(directory=storage.photos_dir()), name="photos")
    return app


app = create_app()
