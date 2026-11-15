"""Roommate notes posted by the student who is subleasing a listing."""

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import JSONType, TimestampMixin


class RoommateFeedback(TimestampMixin, Base):
    __tablename__ = "roommate_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)  # 1-5, how good the roommates are to live with
    tags: Mapped[list[str]] = mapped_column(JSONType, default=list)
    comment: Mapped[str] = mapped_column(Text)
