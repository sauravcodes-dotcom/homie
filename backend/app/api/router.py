from fastapi import APIRouter

from app.api.routes import apartment_intelligence, health, matching

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(matching.router)
api_router.include_router(apartment_intelligence.router)
