"""Shared fixtures. Every test gets a freshly seeded, throwaway database.

The env vars are set before `app` is imported, so the engine binds to a temp
file and never touches backend/recenter.db or checkpoints.db.
"""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="recenter-tests-")
os.environ["RECENTER_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["RECENTER_CHECKPOINT_DB"] = f"{_tmp}/checkpoints.db"
os.environ.pop("RECENTER_TESTING", None)  # the pytest suite stubs the agent itself

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    seed()
    yield


@pytest.fixture
def agent_replies(monkeypatch):
    """Stub the LangGraph agent: no model calls. Returns the list of calls."""
    calls = []

    def fake_agent(content, thread_id="main"):
        calls.append((content, thread_id))
        return f"echo: {content}"

    monkeypatch.setattr(main, "run_agent", fake_agent)
    return calls


@pytest.fixture
def client(agent_replies):
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def all_tasks(client):
    board = client.get("/api/board").json()
    return [t for col in board["columns"].values() for t in col]


def task_named(client, prefix):
    return next(t for t in all_tasks(client) if t["title"].startswith(prefix))


def current_step(task):
    return next((s for s in task["steps"] if not s["done_at"]), None)
