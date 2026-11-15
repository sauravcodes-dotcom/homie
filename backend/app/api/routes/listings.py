from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.database.session import get_db
from app.models import User
from app.schemas.listing import (
    FeedbackCreate,
    FeedbackOut,
    ListingCreate,
    ListingDetail,
    ListingPage,
    ListingTypeLiteral,
)
from app.services import listings

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("", response_model=ListingPage)
def search(
    q: str | None = Query(default=None, max_length=100),
    listing_type: ListingTypeLiteral | None = None,
    neighborhood: str | None = Query(default=None, max_length=120),
    min_rent: int | None = Query(default=None, ge=0),
    max_rent: int | None = Query(default=None, ge=0),
    available_by: date | None = None,
    sort: Literal["newest", "price_asc", "price_desc", "soonest"] = "newest",
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ListingPage:
    """Search listings. Returns the total match count plus one page."""
    return listings.search_listings(
        db,
        q=q,
        listing_type=listing_type,
        neighborhood=neighborhood,
        min_rent=min_rent,
        max_rent=max_rent,
        available_by=available_by,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ListingDetail, status_code=201)
def create(
    data: ListingCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ListingDetail:
    return listings.create_listing(db, user, data)


@router.get("/{listing_id}", response_model=ListingDetail)
def detail(listing_id: int, db: Session = Depends(get_db)) -> ListingDetail:
    return listings.get_listing(db, listing_id)


@router.post("/{listing_id}/roommate-feedback", response_model=FeedbackOut, status_code=201)
def post_feedback(
    listing_id: int,
    data: FeedbackCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FeedbackOut:
    """Roommate feedback channel. Only the listing's subleaser can post."""
    return listings.add_roommate_feedback(db, listing_id, user, data)
