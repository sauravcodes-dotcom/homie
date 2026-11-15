"""Seeker profile, personalised feed, swipes, saved listings and roommate discovery."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.api.presenters import listing_criteria, listings_out, public_user, seeker_criteria
from app.core.errors import HomieError, NotFoundError
from app.database.session import get_db
from app.models import Listing, SeekerProfile, Swipe, User
from app.schemas.listing import (
    FeedItem,
    ListingOut,
    ProfileIn,
    ProfileOut,
    RoommateCard,
    SwipeIn,
    SwipeResult,
)
from app.schemas.matching import Lifestyle
from app.services.embeddings import EmbeddingProvider, get_embedding_provider
from app.services.housing.semantic import calibrated_similarity, worth_embedding
from app.services.matching import score_match, score_roommates

router = APIRouter(tags=["feed"])

# Scoring is cheap (a few thousand listings in well under a second).
MAX_CANDIDATES = 10_000


def _profile(db: Session, user: User) -> SeekerProfile:
    profile = db.scalar(select(SeekerProfile).where(SeekerProfile.user_id == user.id))
    if profile is None:
        raise NotFoundError("Take the lifestyle quiz first so HOMIE can match you")
    return profile


def _profile_out(p: SeekerProfile) -> ProfileOut:
    return ProfileOut(
        budget_max=p.budget_max,
        budget_min=p.budget_min,
        move_in=p.move_in,
        move_out=p.move_out,
        preferred_neighborhoods=list(p.preferred_neighborhoods or []),
        max_distance_miles=p.max_distance_miles,
        lifestyle=Lifestyle.model_validate(p.lifestyle or {}),
        bio=p.bio,
        is_discoverable=p.is_discoverable,
    )


def _swiped(db: Session, user: User, target_type: str) -> set[int]:
    return set(
        db.scalars(
            select(Swipe.target_id).where(
                Swipe.user_id == user.id, Swipe.target_type == target_type
            )
        ).all()
    )


@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), user: User = Depends(current_user)) -> ProfileOut:
    return _profile_out(_profile(db, user))


@router.put("/profile", response_model=ProfileOut)
def put_profile(
    data: ProfileIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    embedder: EmbeddingProvider = Depends(get_embedding_provider),
) -> ProfileOut:
    profile = db.scalar(select(SeekerProfile).where(SeekerProfile.user_id == user.id))
    if profile is None:
        profile = SeekerProfile(user_id=user.id)
        db.add(profile)
    profile.budget_max = data.budget_max
    profile.budget_min = data.budget_min
    profile.move_in = data.move_in
    profile.move_out = data.move_out
    profile.preferred_neighborhoods = [n.strip() for n in data.preferred_neighborhoods if n.strip()]
    profile.max_distance_miles = data.max_distance_miles
    profile.lifestyle = data.lifestyle.model_dump(exclude_none=True)
    profile.bio = data.bio.strip()
    profile.is_discoverable = data.is_discoverable
    profile.embedding = embedder.embed_one(profile.bio) if worth_embedding(profile.bio) else None
    db.commit()
    return _profile_out(profile)


@router.get("/feed", response_model=list[FeedItem])
def feed(
    limit: int = Query(default=20, ge=1, le=50),
    include_swiped: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> list[FeedItem]:
    """Active listings ranked for the signed-in seeker, best first."""
    profile = _profile(db, user)
    stmt = select(Listing).where(Listing.is_active.is_(True), Listing.owner_id != user.id)
    if not include_swiped:
        seen = _swiped(db, user, "listing")
        if seen:
            stmt = stmt.where(Listing.id.not_in(seen))
    rows = db.scalars(stmt.order_by(Listing.id.desc()).limit(MAX_CANDIDATES)).all()

    seeker = seeker_criteria(profile)
    scored = [
        (
            score_match(
                seeker,
                listing_criteria(r),
                semantic_similarity=calibrated_similarity(profile.embedding, r.embedding),
            ),
            r,
        )
        for r in rows
    ]
    # Best fit first, but listings with serious red flags always sink to the bottom.
    scored.sort(key=lambda pair: ((pair[1].risk or {}).get("level") == "high", -pair[0].score))
    top = scored[:limit]
    outs = listings_out(db, [r for _, r in top], user)
    return [FeedItem(listing=o, match=m) for o, (m, _) in zip(outs, top, strict=True)]


@router.get("/roommates", response_model=list[RoommateCard])
def roommates(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> list[RoommateCard]:
    """Other students who opted in to roommate discovery, ranked by compatibility."""
    profile = _profile(db, user)
    stmt = select(SeekerProfile).where(
        SeekerProfile.is_discoverable.is_(True), SeekerProfile.user_id != user.id
    )
    seen = _swiped(db, user, "user")
    if seen:
        stmt = stmt.where(SeekerProfile.user_id.not_in(seen))
    others = db.scalars(stmt.limit(MAX_CANDIDATES)).all()
    users = {
        u.id: u
        for u in db.scalars(select(User).where(User.id.in_([o.user_id for o in others]))).all()
    }
    me = seeker_criteria(profile)
    cards = [
        RoommateCard(
            user=public_user(users.get(o.user_id), o.user_id),
            bio=o.bio,
            budget_max=o.budget_max,
            move_in=o.move_in,
            move_out=o.move_out,
            preferred_neighborhoods=list(o.preferred_neighborhoods or []),
            lifestyle=Lifestyle.model_validate(o.lifestyle or {}),
            match=score_roommates(
                me,
                seeker_criteria(o),
                other_id=o.user_id,
                semantic_similarity=calibrated_similarity(profile.embedding, o.embedding),
            ),
        )
        for o in others
    ]
    cards.sort(key=lambda c: c.match.score, reverse=True)
    return cards[:limit]


@router.post("/swipes", response_model=SwipeResult)
def swipe(
    data: SwipeIn, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> SwipeResult:
    """Save or pass on a listing or a roommate profile. Re-swiping overwrites.

    Saving a student who already saved you is a mutual match: the response says so."""
    if data.target_type == "listing":
        if db.get(Listing, data.target_id) is None:
            raise NotFoundError("Listing not found")
    else:
        if data.target_id == user.id:
            raise HomieError("You cannot swipe on yourself")
        target = db.scalar(
            select(SeekerProfile).where(
                SeekerProfile.user_id == data.target_id, SeekerProfile.is_discoverable.is_(True)
            )
        )
        if target is None:
            raise NotFoundError("Profile not found")
    row = db.scalar(
        select(Swipe).where(
            Swipe.user_id == user.id,
            Swipe.target_type == data.target_type,
            Swipe.target_id == data.target_id,
        )
    )
    if row is None:
        row = Swipe(user_id=user.id, target_type=data.target_type, target_id=data.target_id)
        db.add(row)
    row.action = data.action
    db.commit()
    mutual = (
        data.target_type == "user"
        and data.action == "save"
        and db.scalar(
            select(Swipe.id).where(
                Swipe.user_id == data.target_id,
                Swipe.target_type == "user",
                Swipe.target_id == user.id,
                Swipe.action == "save",
            )
        )
        is not None
    )
    return SwipeResult(mutual=mutual)


@router.delete("/swipes/{target_type}/{target_id}", status_code=204)
def unswipe(
    target_type: str,
    target_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    row = db.scalar(
        select(Swipe).where(
            Swipe.user_id == user.id,
            Swipe.target_type == target_type,
            Swipe.target_id == target_id,
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()


@router.get("/saved", response_model=list[ListingOut])
def saved(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[ListingOut]:
    rows = db.scalars(
        select(Listing)
        .join(Swipe, Swipe.target_id == Listing.id)
        .where(Swipe.user_id == user.id, Swipe.target_type == "listing", Swipe.action == "save")
        .order_by(Swipe.id.desc())
    ).all()
    return listings_out(db, list(rows), user)


@router.get("/saved/roommates", response_model=list[RoommateCard])
def saved_roommates(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> list[RoommateCard]:
    profile = _profile(db, user)
    ids = db.scalars(
        select(Swipe.target_id).where(
            Swipe.user_id == user.id, Swipe.target_type == "user", Swipe.action == "save"
        )
    ).all()
    if not ids:
        return []
    others = db.scalars(
        select(SeekerProfile).where(
            SeekerProfile.user_id.in_(ids), SeekerProfile.is_discoverable.is_(True)
        )
    ).all()
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids))).all()}
    me = seeker_criteria(profile)
    return [
        RoommateCard(
            user=public_user(users.get(o.user_id), o.user_id),
            bio=o.bio,
            budget_max=o.budget_max,
            move_in=o.move_in,
            move_out=o.move_out,
            preferred_neighborhoods=list(o.preferred_neighborhoods or []),
            lifestyle=Lifestyle.model_validate(o.lifestyle or {}),
            match=score_roommates(me, seeker_criteria(o), other_id=o.user_id),
        )
        for o in others
    ]
