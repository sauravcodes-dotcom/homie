"""Swipes, conversations, messages and person-to-person reviews."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import JSONType, TimestampMixin


class Swipe(TimestampMixin, Base):
    """A save or pass on a listing or on another student's roommate profile."""

    __tablename__ = "swipes"
    __table_args__ = (UniqueConstraint("user_id", "target_type", "target_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(20))  # "listing" | "user"
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    action: Mapped[str] = mapped_column(String(10))  # "save" | "pass"


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", "listing_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # user_a_id is always the smaller id so a pair maps to one row.
    user_a_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    listing_id: Mapped[int | None] = mapped_column(
        ForeignKey("listings.id", ondelete="SET NULL"), index=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TypingSignal(Base):
    """Someone is typing in a conversation, until `until`. A table (not process memory) so it
    works across serverless instances; a new table, so create_all adds it to old databases."""

    __tablename__ = "typing_signals"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    until: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PersonReview(TimestampMixin, Base):
    """A review of a student as a roommate, subletter or lister.

    Only allowed between two people who have exchanged messages on HOMIE, and
    limited to one review per author per subject.
    """

    __tablename__ = "person_reviews"
    __table_args__ = (UniqueConstraint("author_id", "subject_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    relationship_kind: Mapped[str] = mapped_column(String(20))  # roommate|subletter|lister
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    # 1-5 each: cleanliness, communication, reliability, respect
    traits: Mapped[dict] = mapped_column(JSONType, default=dict)
    body: Mapped[str] = mapped_column(Text, default="")
