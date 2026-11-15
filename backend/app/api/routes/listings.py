from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.database.session import get_db
from app.models import User
from app.schemas.listing import (
    FeedbackCreate,
    FeedbackOut,
    ListingCreate,
    ListingDetail,
    ListingOut,
)
from app.services import listings

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("", response_model=list[ListingOut])
def list_all(db: Session = Depends(get_db)) -> list[ListingOut]:
    return listings.list_listings(db)


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
