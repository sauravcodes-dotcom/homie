"""Buildings: profiles, resident reviews, grounded Q&A, residency verification."""

import contextlib
from datetime import UTC, datetime, timedelta
from statistics import median

from fastapi import APIRouter, Depends, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import Integer, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import admin_user, current_user, optional_user
from app.api.presenters import display_name
from app.core.config import Settings, get_settings
from app.core.errors import ConflictError, HomieError, NotFoundError
from app.database.session import get_db
from app.models import (
    Apartment,
    ExternalReviewSummary,
    Listing,
    ResidencyVerification,
    Review,
    User,
)
from app.models.base import as_utc
from app.schemas.apartment import (
    ApartmentCard,
    ApartmentCreate,
    ApartmentDetail,
    AskRequest,
    Decision,
    ExternalInfo,
    ReviewCreate,
    ReviewOut,
    VerificationOut,
)
from app.schemas.review import ApartmentInsights, ReviewExtraction, ReviewInput
from app.services import storage
from app.services.apartment_intelligence import aggregate_reviews, extract_review
from app.services.apartment_intelligence.answers import (
    Answer,
    ReviewDoc,
    answer_question,
    summarize,
)
from app.services.embeddings import EmbeddingProvider, get_embedding_provider
from app.services.llm import LLMProvider, get_llm_provider
from app.services.reviews.external import (
    POOL_MULTIPLIER,
    ExternalReviewProvider,
    get_external_provider,
    sample_and_aggregate,
)

router = APIRouter(tags=["buildings"])


def _get(db: Session, apartment_id: int) -> Apartment:
    row = db.get(Apartment, apartment_id)
    if row is None:
        raise NotFoundError("Building not found")
    return row


def _reviews(db: Session, apartment_id: int) -> list[Review]:
    return list(
        db.scalars(
            select(Review).where(Review.apartment_id == apartment_id).order_by(Review.id.desc())
        ).all()
    )


def _insights(reviews: list[Review]) -> ApartmentInsights:
    return aggregate_reviews(
        [
            ReviewInput(
                review_id=r.id,
                is_verified_resident=r.is_verified_resident,
                submitted_on=as_utc(r.created_at).date(),
                extraction=ReviewExtraction.model_validate(r.extraction or {}),
            )
            for r in reviews
        ]
    )


def _cards(db: Session, rows: list[Apartment]) -> list[ApartmentCard]:
    ids = [r.id for r in rows]
    if not ids:
        return []
    stats = {
        apt_id: (count, verified or 0, avg)
        for apt_id, count, verified, avg in db.execute(
            select(
                Review.apartment_id,
                func.count(),
                func.sum(func.cast(Review.is_verified_resident, Integer)),
                func.avg(Review.overall_rating),
            )
            .where(Review.apartment_id.in_(ids))
            .group_by(Review.apartment_id)
        ).all()
    }
    listings = dict(
        db.execute(
            select(Listing.apartment_id, func.count())
            .where(Listing.apartment_id.in_(ids), Listing.is_active.is_(True))
            .group_by(Listing.apartment_id)
        ).all()
    )
    return [
        ApartmentCard(
            id=r.id,
            name=r.name,
            address=r.address,
            neighborhood=r.neighborhood,
            latitude=r.latitude,
            longitude=r.longitude,
            review_count=stats.get(r.id, (0, 0, None))[0],
            verified_count=int(stats.get(r.id, (0, 0, None))[1]),
            average_rating=(
                round(float(stats[r.id][2]), 2) if r.id in stats and stats[r.id][2] else None
            ),
            listing_count=listings.get(r.id, 0),
        )
        for r in rows
    ]


def _external_row(db: Session, apartment_id: int) -> ExternalReviewSummary | None:
    return db.scalar(
        select(ExternalReviewSummary).where(ExternalReviewSummary.apartment_id == apartment_id)
    )


@router.get("/apartments", response_model=list[ApartmentCard])
def search(
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=40, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[ApartmentCard]:
    stmt = select(Apartment)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Apartment.name).like(like),
                func.lower(Apartment.address).like(like),
                func.lower(Apartment.neighborhood).like(like),
            )
        )
    return _cards(db, list(db.scalars(stmt.order_by(Apartment.name).limit(limit)).all()))


@router.post("/apartments", response_model=ApartmentCard, status_code=201)
def create(
    data: ApartmentCreate, db: Session = Depends(get_db), _: User = Depends(current_user)
) -> ApartmentCard:
    """Add a building that is not on HOMIE yet."""
    name, address = data.name.strip(), data.address.strip()
    exists = db.scalar(
        select(Apartment.id).where(
            func.lower(Apartment.name) == name.lower(),
            func.lower(Apartment.address) == address.lower(),
        )
    )
    if exists:
        raise ConflictError("That building is already on HOMIE")
    row = Apartment(
        name=name,
        address=address,
        neighborhood=(data.neighborhood or "").strip() or None,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(row)
    db.commit()
    return _cards(db, [row])[0]


def _resolve_insights(
    db: Session, apartment: Apartment, settings: Settings, provider_enabled: bool
) -> tuple[str, ApartmentInsights | None, list[Review], ExternalReviewSummary | None, ExternalInfo]:
    """Pick the evidence base: HOMIE reviews when there are enough, otherwise the
    stored public-review summary, otherwise whatever HOMIE reviews exist."""
    reviews = _reviews(db, apartment.id)
    if len(reviews) >= settings.min_reviews_for_insights:
        return "homie", _insights(reviews), reviews, None, ExternalInfo(status="not_needed")

    ext = _external_row(db, apartment.id)
    if ext is not None:
        info = ExternalInfo(
            status="ready",
            provider=ext.source,
            sample_size=ext.sample_size,
            pool_size=ext.pool_size,
            average_rating=ext.average_rating,
            fetched_at=as_utc(ext.fetched_at),
        )
        if ext.sample_size > 0:
            return "google", ApartmentInsights.model_validate(ext.insights), reviews, ext, info
    else:
        info = ExternalInfo(status="missing" if provider_enabled else "disabled")
    if reviews:
        return "homie_thin", _insights(reviews), reviews, ext, info
    return "none", None, reviews, ext, info


@router.get("/apartments/{apartment_id}", response_model=ApartmentDetail)
def detail(
    apartment_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
    settings: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm_provider),
    provider: ExternalReviewProvider | None = Depends(get_external_provider),
) -> ApartmentDetail:
    apartment = _get(db, apartment_id)
    source, insights, reviews, ext, info = _resolve_insights(
        db, apartment, settings, provider is not None
    )
    if source == "google" and ext is not None:
        summary = ext.summary
    elif insights is not None:
        label = "HOMIE reviews" if insights.sample_size != 1 else "HOMIE review"
        summary = summarize(
            insights,
            llm,
            source_label=f"{label} ({insights.verified_count} from verified residents)",
        )
    else:
        summary = ""

    rents = db.scalars(
        select(Listing.monthly_rent).where(
            Listing.apartment_id == apartment_id, Listing.is_active.is_(True)
        )
    ).all()
    my_verification, my_review_id = "none", None
    if viewer:
        v = db.scalar(
            select(ResidencyVerification)
            .where(
                ResidencyVerification.user_id == viewer.id,
                ResidencyVerification.apartment_id == apartment_id,
            )
            .order_by(ResidencyVerification.id.desc())
        )
        my_verification = v.status if v else "none"
        my_review_id = next((r.id for r in reviews if r.author_id == viewer.id), None)

    card = _cards(db, [apartment])[0]
    return ApartmentDetail(
        **card.model_dump(),
        insights_source=source,
        min_reviews=settings.min_reviews_for_insights,
        insights=insights,
        summary=summary,
        external=info,
        median_listing_rent=round(median(rents)) if rents else None,
        my_verification=my_verification,
        my_review_id=my_review_id,
    )


@router.post("/apartments/{apartment_id}/external-summary", response_model=ExternalInfo)
def refresh_external_summary(
    apartment_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm_provider),
    provider: ExternalReviewProvider | None = Depends(get_external_provider),
) -> ExternalInfo:
    """Build (or refresh, when stale) the public-review summary for a building that
    has too few HOMIE reviews. Slow: it fetches and analyses up to 100 reviews."""
    apartment = _get(db, apartment_id)
    if provider is None:
        return ExternalInfo(status="disabled")
    if len(_reviews(db, apartment_id)) >= settings.min_reviews_for_insights:
        return ExternalInfo(status="not_needed")

    row = _external_row(db, apartment_id)
    now = datetime.now(UTC)
    stale_after = timedelta(days=settings.external_reviews_refresh_days)
    if row is None or now - as_utc(row.fetched_at) > stale_after:
        size = settings.external_reviews_sample_size
        batch = provider.fetch(apartment, size * POOL_MULTIPLIER)
        result = sample_and_aggregate(batch, llm, sample_size=size)
        if row is None:
            row = ExternalReviewSummary(apartment_id=apartment_id, source=provider.source)
            db.add(row)
        row.sample_size = result.sample_size
        row.pool_size = result.pool_size
        row.average_rating = result.average_rating
        row.insights = result.insights.model_dump(mode="json")
        row.summary = (
            summarize(
                result.insights,
                llm,
                source_label=(
                    f"public Google reviews, a random sample from the {result.pool_size} most "
                    "recent (not verified residents)"
                ),
            )
            if result.sample_size
            else ""
        )
        row.fetched_at = now
        if result.place_id:
            apartment.google_place_id = result.place_id
        db.commit()
    return ExternalInfo(
        status="ready",
        provider=row.source,
        sample_size=row.sample_size,
        pool_size=row.pool_size,
        average_rating=row.average_rating,
        fetched_at=as_utc(row.fetched_at),
    )


def _review_out(r: Review, viewer: User | None) -> ReviewOut:
    findings = (r.extraction or {}).get("findings", [])
    return ReviewOut(
        id=r.id,
        body=r.body,
        overall_rating=r.overall_rating,
        lived_from=r.lived_from,
        lived_to=r.lived_to,
        is_verified_resident=r.is_verified_resident,
        created_at=r.created_at,
        is_mine=bool(viewer and r.author_id == viewer.id),
        topics=sorted({f["category"] for f in findings if f.get("category")}),
    )


@router.get("/apartments/{apartment_id}/reviews", response_model=list[ReviewOut])
def list_reviews(
    apartment_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
) -> list[ReviewOut]:
    """Resident reviews, verified residents first. Authors are not named."""
    _get(db, apartment_id)
    rows = _reviews(db, apartment_id)
    rows.sort(key=lambda r: (not r.is_verified_resident, -r.id))
    return [_review_out(r, viewer) for r in rows]


@router.post("/apartments/{apartment_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(
    apartment_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    llm: LLMProvider = Depends(get_llm_provider),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
) -> ReviewOut:
    _get(db, apartment_id)
    dup = db.scalar(
        select(Review.id).where(Review.apartment_id == apartment_id, Review.author_id == user.id)
    )
    if dup:
        raise ConflictError("You have already reviewed this building")
    verified = db.scalar(
        select(ResidencyVerification.id).where(
            ResidencyVerification.user_id == user.id,
            ResidencyVerification.apartment_id == apartment_id,
            ResidencyVerification.status == "approved",
        )
    )
    body = data.body.strip()
    row = Review(
        apartment_id=apartment_id,
        author_id=user.id,
        is_verified_resident=verified is not None,
        body=body,
        overall_rating=data.overall_rating,
        lived_from=data.lived_from,
        lived_to=data.lived_to,
        extraction=extract_review(body, llm).model_dump(mode="json"),
        embedding=embedder.embed_one(body),
        created_at=datetime.now(UTC),
    )
    db.add(row)
    db.commit()
    return _review_out(row, user)


@router.delete("/apartments/{apartment_id}/reviews/mine", status_code=204)
def delete_my_review(
    apartment_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> None:
    row = db.scalar(
        select(Review).where(Review.apartment_id == apartment_id, Review.author_id == user.id)
    )
    if row is not None:
        db.delete(row)
        db.commit()


@router.post("/apartments/{apartment_id}/ask", response_model=Answer)
def ask(
    apartment_id: int,
    req: AskRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm_provider),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
    provider: ExternalReviewProvider | None = Depends(get_external_provider),
) -> Answer:
    """Answer a question about the building from its reviews, with citations."""
    apartment = _get(db, apartment_id)
    source, insights, reviews, _, _ = _resolve_insights(
        db, apartment, settings, provider is not None
    )
    if insights is None:
        insights = aggregate_reviews([])
    docs = (
        []
        if source == "google"
        else [
            ReviewDoc(
                review_id=r.id,
                body=r.body,
                is_verified_resident=r.is_verified_resident,
                submitted_on=as_utc(r.created_at).date(),
                embedding=r.embedding,
                extraction=r.extraction,
            )
            for r in reviews
        ]
    )
    return answer_question(
        req.question,
        insights=insights,
        docs=docs,
        source="google" if source == "google" else "homie",
        llm=llm,
        embedder=embedder,
    )


# --- Residency verification -------------------------------------------------


@router.post("/apartments/{apartment_id}/verification", status_code=201)
async def submit_verification(
    apartment_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict[str, str]:
    """Upload a lease page (image or PDF) to earn the verified-resident badge here."""
    _get(db, apartment_id)
    existing = db.scalar(
        select(ResidencyVerification).where(
            ResidencyVerification.user_id == user.id,
            ResidencyVerification.apartment_id == apartment_id,
            ResidencyVerification.status.in_(["pending", "approved"]),
        )
    )
    if existing:
        raise ConflictError(f"Your verification here is already {existing.status}")
    name = storage.save_private_document(await file.read())
    db.add(
        ResidencyVerification(
            user_id=user.id, apartment_id=apartment_id, document_path=name, status="pending"
        )
    )
    db.commit()
    return {"status": "pending"}


def _verification(db: Session, verification_id: int) -> ResidencyVerification:
    row = db.get(ResidencyVerification, verification_id)
    if row is None:
        raise NotFoundError("Verification not found")
    return row


@router.get("/admin/verifications", response_model=list[VerificationOut])
def admin_list(
    status: str = "pending", db: Session = Depends(get_db), _: User = Depends(admin_user)
) -> list[VerificationOut]:
    rows = db.scalars(
        select(ResidencyVerification)
        .where(ResidencyVerification.status == status)
        .order_by(ResidencyVerification.id.asc())
        .limit(200)
    ).all()
    out = []
    for r in rows:
        apartment = db.get(Apartment, r.apartment_id)
        out.append(
            VerificationOut(
                id=r.id,
                apartment_id=r.apartment_id,
                apartment_name=apartment.name if apartment else "",
                user_display=display_name(db.get(User, r.user_id)),
                status=r.status,
                created_at=r.created_at,
                has_document=bool(r.document_path),
            )
        )
    return out


@router.get("/admin/verifications/{verification_id}/document")
def admin_document(
    verification_id: int, db: Session = Depends(get_db), _: User = Depends(admin_user)
) -> FileResponse:
    row = _verification(db, verification_id)
    if not row.document_path:
        raise HomieError("The document was deleted after the decision")
    return FileResponse(
        storage.private_document_path(row.document_path),
        headers={"Cache-Control": "no-store", "Content-Disposition": "inline"},
    )


@router.post("/admin/verifications/{verification_id}/decision", response_model=VerificationOut)
def admin_decide(
    verification_id: int,
    decision: Decision,
    db: Session = Depends(get_db),
    _: User = Depends(admin_user),
) -> VerificationOut:
    """Approve or reject. Approval marks the student's reviews of that building as
    verified. The uploaded document is deleted either way."""
    row = _verification(db, verification_id)
    if row.status != "pending":
        raise ConflictError(f"Already {row.status}")
    row.status = "approved" if decision.approve else "rejected"
    row.decided_at = datetime.now(UTC)
    if decision.approve:
        for review in db.scalars(
            select(Review).where(
                Review.apartment_id == row.apartment_id, Review.author_id == row.user_id
            )
        ).all():
            review.is_verified_resident = True
    if row.document_path:
        with contextlib.suppress(HomieError, OSError):
            storage.private_document_path(row.document_path).unlink()
        row.document_path = None
    db.commit()
    apartment = db.get(Apartment, row.apartment_id)
    return VerificationOut(
        id=row.id,
        apartment_id=row.apartment_id,
        apartment_name=apartment.name if apartment else "",
        user_display=display_name(db.get(User, row.user_id)),
        status=row.status,
        created_at=row.created_at,
        has_document=False,
    )
