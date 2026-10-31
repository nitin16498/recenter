"""Database setup — SQLite via SQLAlchemy (REC-7).

Single-file SQLite DB for v1. Swapping to Postgres later means changing
DATABASE_URL and nothing else. Run `python -m app.db` to create tables.
Tests point RECENTER_DATABASE_URL at a throwaway file so they never touch
recenter.db.
(Alembic migrations come when the schema starts evolving; create_all is
enough while there's one user and no production data.)
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("RECENTER_DATABASE_URL", "sqlite:///./recenter.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # FastAPI: multiple threads, one file
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields a session, always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import models so they register on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created.")
