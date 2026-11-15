from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import current_user, optional_user
from app.api.presenters import listing_criteria, listings_out, seeker_criteria
from app.core.errors import ForbiddenError, HomieError, NotFoundError
from app.database.session import get_db
from app.models import Apartment, Listing, ListingType, SeekerProfile, User
from app.schemas.listing import (
    DraftRequest,
    DraftResponse,
    FeedbackCreate,
    FeedbackOut,
    ListingCreate,
    ListingDetail,
    ListingOut,
    ListingUpdate,
    MapPoint,
    RentBenchmark,
    RiskCheckRequest,
    RiskReport,
)
from app.services import listings as feedback_service
from app.services import storage
from app.services.embeddings import EmbeddingProvider, get_embedding_provider
from app.services.housing.benchmark import rent_benchmark
from app.services.housing.geo import travel_to_campus
from app.services.housing.risk import assess_risk
from app.services.housing.semantic import calibrated_similarity, listing_text, worth_embedding
from app.services.housing.writer import draft_listing
from app.services.llm import LLMProvider, get_llm_provider
from app.services.matching import score_match

router = APIRouter(tags=["listings"])


def _get(db: Session, listing_id: int) -> Listing:
    row = db.get(Listing, listing_id)
    if row is None:
        raise NotFoundError("Listing not found")
    return row


def _apply(db: Session, row: Listing, data: ListingCreate, embedder: EmbeddingProvider) -> None:
    apartment_id = data.apartment_id
    if apartment_id is not None:
        if db.get(Apartment, apartment_id) is None:
            raise HomieError("That building does not exist")
    elif data.building_name:
        # Posting by building name: reuse the building if it exists, else add it.
        name = data.building_name.strip()
        apartment = db.scalar(select(Apartment).where(Apartment.name == name))
        if apartment is None:
            apartment = Apartment(
                name=name,
                address=(data.address or "").strip(),
                neighborhood=data.neighborhood,
                latitude=data.latitude,
                longitude=data.longitude,
            )
            db.add(apartment)
            db.flush([apartment])
        apartment_id = apartment.id
    for field in (
        "listing_type",
        "title",
        "description",
        "monthly_rent",
        "available_from",
        "available_to",
        "neighborhood",
        "latitude",
        "longitude",
        "unit",
        "photos",
    ):
        setattr(row, field, getattr(data, field))
    row.apartment_id = apartment_id
    row.title = data.title.strip()
    row.lifestyle = data.lifestyle.model_dump(exclude_none=True)
    text = listing_text(row.title, row.description)
    row.embedding = embedder.embed_one(text) if worth_embedding(text) else None

    db.flush()
    others = db.scalars(
        select(Listing.embedding)
        .where(
            Listing.owner_id != row.owner_id,
            Listing.is_active.is_(True),
            Listing.embedding.is_not(None),
        )
        .limit(500)
    ).all()
    bench = rent_benchmark(
        db,
        row.monthly_rent,
        apartment_id=row.apartment_id,
        neighborhood=row.neighborhood,
        exclude_listing_id=row.id,
    )
    row.risk = assess_risk(
        title=row.title,
        description=row.description,
        benchmark=bench,
        has_photos=bool(row.photos),
        embedding=row.embedding,
        other_embeddings=[o for o in others if o],
    ).model_dump()


@router.get("/listings", response_model=list[ListingOut])
def browse(
    q: str | None = Query(default=None, max_length=100),
    listing_type: ListingType | None = None,
    min_rent: int | None = Query(default=None, ge=0),
    max_rent: int | None = Query(default=None, ge=0),
    neighborhood: str | None = Query(default=None, max_length=120),
    move_in_by: date | None = None,
    apartment_id: int | None = None,
    sort: Literal["newest", "rent_asc", "rent_desc"] = "newest",
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
) -> list[ListingOut]:
    """Browse active listings with filters."""
    stmt = select(Listing).where(Listing.is_active.is_(True))
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Listing.title).like(like),
                func.lower(Listing.description).like(like),
                func.lower(Listing.neighborhood).like(like),
            )
        )
    if listing_type:
        stmt = stmt.where(Listing.listing_type == listing_type)
    if min_rent is not None:
        stmt = stmt.where(Listing.monthly_rent >= min_rent)
    if max_rent is not None:
        stmt = stmt.where(Listing.monthly_rent <= max_rent)
    if neighborhood:
        stmt = stmt.where(func.lower(Listing.neighborhood) == neighborhood.strip().lower())
    if move_in_by:
        stmt = stmt.where(Listing.available_from <= move_in_by)
    if apartment_id is not None:
        stmt = stmt.where(Listing.apartment_id == apartment_id)
    order = {
        "newest": Listing.id.desc(),
        "rent_asc": Listing.monthly_rent.asc(),
        "rent_desc": Listing.monthly_rent.desc(),
    }[sort]
    rows = db.scalars(stmt.order_by(order).limit(limit).offset(offset)).all()
    return listings_out(db, list(rows), viewer)


@router.get("/listings/neighborhoods", response_model=list[str])
def neighborhoods(db: Session = Depends(get_db)) -> list[str]:
    rows = db.scalars(
        select(Listing.neighborhood)
        .where(Listing.is_active.is_(True), Listing.neighborhood.is_not(None))
        .distinct()
    ).all()
    return sorted({r for r in rows if r})


@router.get("/listings/mine", response_model=list[ListingOut])
def mine(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[ListingOut]:
    rows = db.scalars(
        select(Listing).where(Listing.owner_id == user.id).order_by(Listing.id.desc())
    ).all()
    return listings_out(db, list(rows), user)


@router.get("/map/listings", response_model=list[MapPoint])
def map_points(db: Session = Depends(get_db)) -> list[MapPoint]:
    """Active listings that have coordinates, with estimated travel time to campus."""
    rows = db.scalars(
        select(Listing)
        .where(
            Listing.is_active.is_(True),
            Listing.latitude.is_not(None),
            Listing.longitude.is_not(None),
        )
        .limit(500)
    ).all()
    return [
        MapPoint(
            id=r.id,
            title=r.title,
            monthly_rent=r.monthly_rent,
            listing_type=r.listing_type,
            latitude=r.latitude,
            longitude=r.longitude,
            neighborhood=r.neighborhood,
            travel=travel_to_campus(r.latitude, r.longitude),
            photo=(r.photos or [None])[0],
        )
        for r in rows
    ]


@router.post("/listings", response_model=ListingDetail, status_code=201)
def create(
    data: ListingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
) -> ListingDetail:
    row = Listing(owner_id=user.id, is_active=True)
    db.add(row)
    _apply(db, row, data, embedder)
    db.commit()
    return _detail(db, row, user)


@router.post(
    "/listings/{listing_id}/roommate-feedback", response_model=FeedbackOut, status_code=201
)
def post_feedback(
    listing_id: int,
    data: FeedbackCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FeedbackOut:
    """Roommate feedback channel. Only the listing's subleaser can post."""
    return feedback_service.add_roommate_feedback(db, listing_id, user, data)


@router.get("/listings/{listing_id}", response_model=ListingDetail)
def detail(
    listing_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
) -> ListingDetail:
    return _detail(db, _get(db, listing_id), viewer)


def _detail(db: Session, row: Listing, viewer: User | None) -> ListingDetail:
    out = listings_out(db, [row], viewer)[0]
    match = None
    if viewer and viewer.id != row.owner_id:
        profile = db.scalar(select(SeekerProfile).where(SeekerProfile.user_id == viewer.id))
        if profile:
            match = score_match(
                seeker_criteria(profile),
                listing_criteria(row),
                semantic_similarity=calibrated_similarity(profile.embedding, row.embedding),
            )
    return ListingDetail(
        **out.model_dump(),
        feedback=feedback_service.feedback_for_listing(db, row.id),
        benchmark=rent_benchmark(
            db,
            row.monthly_rent,
            apartment_id=row.apartment_id,
            neighborhood=row.neighborhood,
            exclude_listing_id=row.id,
        ),
        match=match,
    )


@router.put("/listings/{listing_id}", response_model=ListingOut)
def update(
    listing_id: int,
    data: ListingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
) -> ListingOut:
    row = _get(db, listing_id)
    if row.owner_id != user.id:
        raise ForbiddenError("You can only edit your own listings")
    _apply(db, row, data, embedder)
    row.is_active = data.is_active
    db.commit()
    return listings_out(db, [row], user)[0]


@router.delete("/listings/{listing_id}", status_code=204)
def delete(
    listing_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> None:
    row = _get(db, listing_id)
    if row.owner_id != user.id:
        raise ForbiddenError("You can only delete your own listings")
    db.delete(row)
    db.commit()


@router.post("/uploads/photo")
async def upload_photo(file: UploadFile, _: User = Depends(current_user)) -> dict[str, str]:
    """Upload one listing photo (JPEG, PNG or WebP). Returns its URL."""
    return {"url": storage.save_photo(await file.read())}


@router.post("/ai/listing-draft", response_model=DraftResponse)
def listing_draft(
    req: DraftRequest,
    _: User = Depends(current_user),
    llm: LLMProvider = Depends(get_llm_provider),
) -> DraftResponse:
    """Turn rough notes into a listing title and description."""
    return draft_listing(req, llm)


@router.post("/ai/risk-check", response_model=RiskReport)
def risk_check(req: RiskCheckRequest, db: Session = Depends(get_db)) -> RiskReport:
    """Preview the red-flag check for a draft listing."""
    bench = rent_benchmark(
        db, req.monthly_rent, apartment_id=req.apartment_id, neighborhood=req.neighborhood
    )
    return assess_risk(
        title=req.title, description=req.description, benchmark=bench, has_photos=req.has_photos
    )


@router.get("/benchmark", response_model=RentBenchmark | None)
def benchmark(
    rent: int = Query(gt=0),
    neighborhood: str | None = None,
    apartment_id: int | None = None,
    db: Session = Depends(get_db),
) -> RentBenchmark | None:
    return rent_benchmark(db, rent, apartment_id=apartment_id, neighborhood=neighborhood)
