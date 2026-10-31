"""Seed data (REC-7, extended in REC-27/30)."""

from app.models import Epic, Message, Story, Task, TaskStep
from app.seed import seed


def test_seed_counts(db):
    assert db.query(Epic).count() == 3
    assert db.query(Story).count() == 4
    assert db.query(Task).count() == 7
    assert db.query(TaskStep).count() == 20


def test_seed_skips_an_already_seeded_db(db):
    seed()
    assert db.query(Task).count() == 7
    assert db.query(Message).count() == 1
