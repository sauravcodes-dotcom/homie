from fastapi import APIRouter

from app.api.routes import apartment_intelligence, auth, health, listings, matching

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(listings.router)
api_router.include_router(matching.router)
api_router.include_router(apartment_intelligence.router)
