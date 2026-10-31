"""PATCH /api/tasks/{id} (REC-27)."""

import pytest

from app.models import Task
from tests.conftest import task_named


def test_partial_update_changes_only_sent_fields(client):
    t = task_named(client, "Pick a product")
    updated = client.patch(f"/api/tasks/{t['id']}", json={"note": "check reviews"}).json()
    assert updated["note"] == "check reviews"
    assert updated["title"] == t["title"]
    assert updated["est_minutes"] == t["est_minutes"]
    assert updated["steps"] == t["steps"]


def test_null_clears_optional_fields(client):
    t = task_named(client, "Pick a product")
    updated = client.patch(f"/api/tasks/{t['id']}", json={"est_minutes": None, "note": None}).json()
    assert updated["est_minutes"] is None and updated["note"] is None


def test_title_is_trimmed(client):
    t = task_named(client, "Pick a product")
    assert client.patch(f"/api/tasks/{t['id']}", json={"title": "  New title  "}).json()["title"] == "New title"


@pytest.mark.parametrize(
    "body",
    [
        {"title": "   "},
        {"title": None},
        {"status": None},
        {"status": "bogus"},
        {"est_minutes": 0},
        {"est_minutes": -5},
    ],
)
def test_invalid_updates_are_rejected(client, body):
    t = task_named(client, "Pick a product")
    assert client.patch(f"/api/tasks/{t['id']}", json=body).status_code == 422


def test_unknown_task_is_404(client):
    assert client.patch("/api/tasks/9999", json={"note": "x"}).status_code == 404


def test_status_done_stamps_and_reopen_clears_completed_at(client, db):
    t = task_named(client, "Pick a product")
    client.patch(f"/api/tasks/{t['id']}", json={"status": "done"})
    assert db.get(Task, t["id"]).completed_at is not None
    db.expire_all()
    client.patch(f"/api/tasks/{t['id']}", json={"status": "todo"})
    assert db.get(Task, t["id"]).completed_at is None


def test_first_action_is_no_longer_accepted(client):
    # Unknown fields are ignored, not stored: steps replaced first_action (REC-30).
    t = task_named(client, "Pick a product")
    updated = client.patch(f"/api/tasks/{t['id']}", json={"first_action": "x"}).json()
    assert "first_action" not in updated
