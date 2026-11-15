"""In-app messaging and person-to-person reviews."""

from datetime import UTC, datetime, timedelta
from statistics import mean

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import current_user, optional_user
from app.api.presenters import public_user
from app.core.errors import ForbiddenError, HomieError, NotFoundError
from app.database.session import get_db
from app.models import (
    ChatMessage,
    Conversation,
    Listing,
    PersonReview,
    SeekerProfile,
    TypingSignal,
    User,
)
from app.schemas.social import (
    ConversationDetail,
    ConversationOut,
    ConversationStart,
    MessageIn,
    MessageOut,
    PersonProfile,
    PersonReviewIn,
    PersonReviewOut,
)

router = APIRouter(tags=["social"])

# Both people must have written at least once before either can review the other.
MIN_REVIEWS_TO_SHOW_AVERAGE = 1


def _conversation(db: Session, conversation_id: int, user: User) -> Conversation:
    row = db.get(Conversation, conversation_id)
    if row is None or user.id not in (row.user_a_id, row.user_b_id):
        raise NotFoundError("Conversation not found")
    return row


def _both_spoke(db: Session, a: int, b: int) -> bool:
    """True when each of the two users has sent the other at least one message."""
    lo, hi = sorted((a, b))
    senders = set(
        db.scalars(
            select(ChatMessage.sender_id)
            .join(Conversation, Conversation.id == ChatMessage.conversation_id)
            .where(Conversation.user_a_id == lo, Conversation.user_b_id == hi)
            .distinct()
        ).all()
    )
    return {a, b} <= senders


def _conversation_out(db: Session, row: Conversation, user: User) -> ConversationOut:
    other_id = row.user_b_id if row.user_a_id == user.id else row.user_a_id
    last = db.scalar(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == row.id)
        .order_by(ChatMessage.id.desc())
        .limit(1)
    )
    unread = db.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.conversation_id == row.id,
            ChatMessage.sender_id != user.id,
            ChatMessage.read_at.is_(None),
        )
    )
    listing = db.get(Listing, row.listing_id) if row.listing_id else None
    return ConversationOut(
        id=row.id,
        other=public_user(db.get(User, other_id), other_id),
        listing_id=row.listing_id,
        listing_title=listing.title if listing else None,
        last_message=last.body[:140] if last else None,
        last_message_at=last.created_at if last else None,
        unread=unread or 0,
        can_review=_both_spoke(db, user.id, other_id),
    )


def _message_out(m: ChatMessage, user: User) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender_id=m.sender_id,
        is_mine=m.sender_id == user.id,
        body=m.body,
        created_at=m.created_at,
    )


@router.get("/conversations", response_model=list[ConversationOut])
def conversations(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> list[ConversationOut]:
    rows = db.scalars(
        select(Conversation)
        .where(or_(Conversation.user_a_id == user.id, Conversation.user_b_id == user.id))
        .order_by(Conversation.last_message_at.desc())
    ).all()
    return [_conversation_out(db, r, user) for r in rows]


@router.get("/conversations/unread-count")
def unread_count(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict[str, int]:
    count = db.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .join(Conversation, Conversation.id == ChatMessage.conversation_id)
        .where(
            or_(Conversation.user_a_id == user.id, Conversation.user_b_id == user.id),
            ChatMessage.sender_id != user.id,
            ChatMessage.read_at.is_(None),
        )
    )
    return {"unread": count or 0}


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def start_conversation(
    data: ConversationStart, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> ConversationOut:
    """Message a lister about a listing, or a discoverable student about rooming together."""
    if data.listing_id is not None:
        listing = db.get(Listing, data.listing_id)
        if listing is None:
            raise NotFoundError("Listing not found")
        other_id = listing.owner_id
    else:
        other_id = data.user_id
        discoverable = db.scalar(
            select(SeekerProfile.id).where(
                SeekerProfile.user_id == other_id, SeekerProfile.is_discoverable.is_(True)
            )
        )
        if discoverable is None:
            raise NotFoundError("That student is not open to roommate messages")
    if other_id == user.id:
        raise HomieError("You cannot message yourself")

    lo, hi = sorted((user.id, other_id))
    stmt = select(Conversation).where(Conversation.user_a_id == lo, Conversation.user_b_id == hi)
    stmt = stmt.where(
        Conversation.listing_id == data.listing_id
        if data.listing_id is not None
        else Conversation.listing_id.is_(None)
    )
    row = db.scalar(stmt)
    if row is None:
        row = Conversation(user_a_id=lo, user_b_id=hi, listing_id=data.listing_id)
        db.add(row)
        db.flush()
    now = datetime.now(UTC)
    db.add(
        ChatMessage(
            conversation_id=row.id, sender_id=user.id, body=data.body.strip(), created_at=now
        )
    )
    row.last_message_at = now
    db.commit()
    return _conversation_out(db, row, user)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def conversation_detail(
    conversation_id: int,
    after_id: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> ConversationDetail:
    """Messages in a conversation (optionally only those after `after_id`). Marks them read."""
    row = _conversation(db, conversation_id, user)
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == row.id, ChatMessage.id > after_id)
        .order_by(ChatMessage.id.asc())
        .limit(500)
    ).all()
    now = datetime.now(UTC)
    dirty = False
    for m in messages:
        if m.sender_id != user.id and m.read_at is None:
            m.read_at = now
            dirty = True
    if dirty:
        db.commit()
    base = _conversation_out(db, row, user)
    read_up_to = db.scalar(
        select(func.max(ChatMessage.id)).where(
            ChatMessage.conversation_id == row.id,
            ChatMessage.sender_id == user.id,
            ChatMessage.read_at.is_not(None),
        )
    )
    other_id = row.user_b_id if row.user_a_id == user.id else row.user_a_id
    typing_until = db.scalar(
        select(TypingSignal.until).where(
            TypingSignal.conversation_id == row.id, TypingSignal.user_id == other_id
        )
    )
    return ConversationDetail(
        **base.model_dump(),
        messages=[_message_out(m, user) for m in messages],
        other_read_up_to=read_up_to,
        other_typing=typing_until is not None and _aware(typing_until) > now,
    )


def _aware(t: datetime) -> datetime:
    # SQLite hands back naive datetimes; they were written in UTC.
    return t if t.tzinfo else t.replace(tzinfo=UTC)


TYPING_TTL = timedelta(seconds=6)


@router.post("/conversations/{conversation_id}/typing", status_code=204)
def typing(
    conversation_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> None:
    """Say "I am typing" for the next few seconds. The other side sees it on its next poll."""
    row = _conversation(db, conversation_id, user)
    signal = db.scalar(
        select(TypingSignal).where(
            TypingSignal.conversation_id == row.id, TypingSignal.user_id == user.id
        )
    )
    until = datetime.now(UTC) + TYPING_TTL
    if signal is None:
        db.add(TypingSignal(conversation_id=row.id, user_id=user.id, until=until))
    else:
        signal.until = until
    db.commit()


@router.post(
    "/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=201
)
def send_message(
    conversation_id: int,
    data: MessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> MessageOut:
    row = _conversation(db, conversation_id, user)
    now = datetime.now(UTC)
    msg = ChatMessage(
        conversation_id=row.id, sender_id=user.id, body=data.body.strip(), created_at=now
    )
    db.add(msg)
    row.last_message_at = now
    # Sending ends "typing".
    signal = db.scalar(
        select(TypingSignal).where(
            TypingSignal.conversation_id == row.id, TypingSignal.user_id == user.id
        )
    )
    if signal is not None:
        signal.until = now
    db.commit()
    return _message_out(msg, user)


# --- Person reviews ---------------------------------------------------------


def _review_out(r: PersonReview, viewer: User | None) -> PersonReviewOut:
    return PersonReviewOut(
        id=r.id,
        relationship_kind=r.relationship_kind,
        rating=r.rating,
        traits=dict(r.traits or {}),
        body=r.body,
        created_at=r.created_at,
        is_mine=bool(viewer and viewer.id == r.author_id),
    )


@router.get("/people/{user_id}", response_model=PersonProfile)
def person_profile(
    user_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
) -> PersonProfile:
    """A student's reputation: reviews from people they have dealt with on HOMIE.

    Reviews are shown without the author's name.
    """
    subject = db.get(User, user_id)
    if subject is None:
        raise NotFoundError("Student not found")
    rows = db.scalars(
        select(PersonReview)
        .where(PersonReview.subject_id == user_id)
        .order_by(PersonReview.id.desc())
    ).all()
    traits: dict[str, list[int]] = {}
    for r in rows:
        for k, v in (r.traits or {}).items():
            traits.setdefault(k, []).append(v)
    mine = next((r for r in rows if viewer and r.author_id == viewer.id), None)
    return PersonProfile(
        user=public_user(subject),
        review_count=len(rows),
        average_rating=round(mean(r.rating for r in rows), 2) if rows else None,
        trait_averages={k: round(mean(v), 2) for k, v in traits.items()},
        reviews=[_review_out(r, viewer) for r in rows],
        can_review=bool(viewer and viewer.id != user_id and _both_spoke(db, viewer.id, user_id)),
        my_review=_review_out(mine, viewer) if mine else None,
    )


@router.put("/people/{user_id}/review", response_model=PersonReviewOut)
def review_person(
    user_id: int,
    data: PersonReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> PersonReviewOut:
    """Create or update your review of a student you have exchanged messages with."""
    if user_id == user.id:
        raise HomieError("You cannot review yourself")
    if db.get(User, user_id) is None:
        raise NotFoundError("Student not found")
    if not _both_spoke(db, user.id, user_id):
        raise ForbiddenError(
            "You can review someone once you have both messaged each other on HOMIE"
        )
    row = db.scalar(
        select(PersonReview).where(
            PersonReview.author_id == user.id, PersonReview.subject_id == user_id
        )
    )
    if row is None:
        row = PersonReview(author_id=user.id, subject_id=user_id)
        db.add(row)
    row.relationship_kind = data.relationship_kind
    row.rating = data.rating
    row.traits = dict(data.traits)
    row.body = data.body.strip()
    db.commit()
    return _review_out(row, user)


@router.delete("/people/{user_id}/review", status_code=204)
def delete_person_review(
    user_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> None:
    row = db.scalar(
        select(PersonReview).where(
            PersonReview.author_id == user.id, PersonReview.subject_id == user_id
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()
