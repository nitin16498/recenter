"""Data model (REC-7).

Design decisions this encodes (from planning sessions):

- Identity is the root: habits and stories vote for an identity.
- Habit vs Task are SEPARATE tables — habits recur via daily occurrences,
  tasks are one-shot and completable in one sitting.
- A Habit is a template. Each day, the relevant trigger slot materializes a
  HabitOccurrence (the actual checkable item / "vote"). Check-ins read and
  resolve occurrences; stats aggregate over them.
- Epic (life area) -> Story (objective with a definition of done) -> Task
  (one sitting, has a first physical action).
- Messages are stored for UI history; the agent reads a recent window only.
- MemoryFact holds distilled facts extracted from conversations (not RAG
  over raw chat). `embedding` stays NULL until semantic lookup is needed.
"""

import enum
from datetime import date, datetime, timezone

from app.db import Base
from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TriggerSlot(str, enum.Enum):
    morning = "morning"
    lunch = "lunch"
    evening = "evening"


class OccurrenceStatus(str, enum.Enum):
    pending = "pending"
    done = "done"
    missed = "missed"


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class Identity(Base):
    """Who the user wants to become. e.g. 'I am an engineer who ships projects'."""

    __tablename__ = "identities"

    id: Mapped[int] = mapped_column(primary_key=True)
    statement: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    habits: Mapped[list["Habit"]] = relationship(back_populates="identity")
    stories: Mapped[list["Story"]] = relationship(back_populates="identity")


class Habit(Base):
    """Recurring habit template. Materializes a HabitOccurrence per day."""

    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    identity_id: Mapped[int | None] = mapped_column(ForeignKey("identities.id"))
    name: Mapped[str] = mapped_column(String(200))
    cue: Mapped[str | None] = mapped_column(String(300))  # habit stacking: "after dinner"
    trigger_slot: Mapped[TriggerSlot] = mapped_column(Enum(TriggerSlot))
    two_minute_version: Mapped[str | None] = mapped_column(String(300))  # shrunk form
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    identity: Mapped[Identity | None] = relationship(back_populates="habits")
    occurrences: Mapped[list["HabitOccurrence"]] = relationship(back_populates="habit")


class HabitOccurrence(Base):
    """One day's instance of a habit — the checkable item and the identity vote.

    Resolved by the user (board/chat check-off) or by a check-in conversation.
    Unresolved occurrences are marked missed at the night ceremony, which arms
    never-miss-twice (tomorrow offers two_minute_version).
    """

    __tablename__ = "habit_occurrences"
    __table_args__ = (UniqueConstraint("habit_id", "on_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id"))
    on_date: Mapped[date] = mapped_column(Date)
    status: Mapped[OccurrenceStatus] = mapped_column(
        Enum(OccurrenceStatus), default=OccurrenceStatus.pending
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    quality: Mapped[int | None] = mapped_column(Integer)  # optional 1-5, one tap
    note: Mapped[str | None] = mapped_column(Text)  # optional, keep friction low

    habit: Mapped[Habit] = relationship(back_populates="occurrences")


class Epic(Base):
    """Life area: Work, Life, Projects, Cooking."""

    __tablename__ = "epics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    stories: Mapped[list["Story"]] = relationship(back_populates="epic")


class Story(Base):
    """An objective with a definition of done. e.g. 'Car is protected from heat'."""

    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(primary_key=True)
    epic_id: Mapped[int] = mapped_column(ForeignKey("epics.id"))
    identity_id: Mapped[int | None] = mapped_column(ForeignKey("identities.id"))
    title: Mapped[str] = mapped_column(String(200))
    definition_of_done: Mapped[str | None] = mapped_column(Text)
    done: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    epic: Mapped[Epic] = relationship(back_populates="stories")
    identity: Mapped[Identity | None] = relationship(back_populates="stories")
    tasks: Mapped[list["Task"]] = relationship(back_populates="story")


class Task(Base):
    """One-sitting unit of work with a first physical action.

    The one-sitting rule: if it can't be finished in the sitting you start it,
    the planner should break it down further.
    """

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    story_id: Mapped[int | None] = mapped_column(ForeignKey("stories.id"))
    title: Mapped[str] = mapped_column(String(200))
    first_action: Mapped[str | None] = mapped_column(String(300))
    est_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.todo)
    order_in_story: Mapped[int | None] = mapped_column(Integer)  # backwards-planned sequence
    scheduled_for: Mapped[date | None] = mapped_column(Date)  # today's plan membership
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    story: Mapped[Story | None] = relationship(back_populates="tasks")


class Message(Base):
    """Chat history for UI rendering. The agent reads a recent window only;
    long-term context comes from MemoryFact + structured queries."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(64), default="main", index=True)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant | system
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MemoryFact(Base):
    """Distilled durable fact about the user, extracted from conversations.

    e.g. subject='car', fact='Drives a Honda Civic, parked outdoors in the sun'.
    Keyword lookup first; `embedding` fills in when semantic search is needed (v1.5).
    """

    __tablename__ = "memory_facts"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(100), index=True)
    fact: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(100))  # e.g. "night-ceremony 2026-08-17"
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
