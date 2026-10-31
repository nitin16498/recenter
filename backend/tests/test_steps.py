"""Task steps (REC-30): complete, undo, replace."""

from app.models import TaskStep
from tests.conftest import current_step, task_named


def complete(client, task, step):
    return client.post(f"/api/tasks/{task['id']}/steps/{step['id']}/complete")


def undo(client, task, step):
    return client.post(f"/api/tasks/{task['id']}/steps/{step['id']}/undo")


def replace(client, task, steps):
    return client.put(f"/api/tasks/{task['id']}/steps", json={"steps": steps})


# --- complete / undo ---------------------------------------------------------


def test_complete_advances_current_step(client):
    t = task_named(client, "Download insurance")
    r = complete(client, t, current_step(t))
    assert r.status_code == 200
    assert current_step(r.json())["text"] == "Download the coverage summary"
    assert r.json()["status"] == "in_progress"


def test_complete_is_idempotent(client):
    t = task_named(client, "Download insurance")
    step = current_step(t)
    first = complete(client, t, step).json()
    again = complete(client, t, step).json()
    done_at = lambda task: next(s["done_at"] for s in task["steps"] if s["id"] == step["id"])  # noqa: E731
    assert done_at(first) == done_at(again)


def test_completing_a_step_on_a_todo_task_starts_it(client):
    t = task_named(client, "Pick a product")
    assert t["status"] == "todo"
    assert complete(client, t, current_step(t)).json()["status"] == "in_progress"


def test_completing_on_a_done_task_keeps_it_done(client):
    t = task_named(client, "Download insurance")
    client.patch(f"/api/tasks/{t['id']}", json={"status": "done"})
    assert complete(client, t, current_step(t)).json()["status"] == "done"


def test_completing_the_last_step_does_not_auto_finish_the_task(client):
    t = task_named(client, "Book the hospital")
    r = complete(client, t, current_step(t)).json()
    assert current_step(r) is None
    assert r["status"] == "in_progress"  # the UI asks "Move to Done?" instead


def test_undo_reopens_a_step_and_leaves_status(client):
    t = task_named(client, "Pick a product")
    step = current_step(t)
    started = complete(client, t, step).json()
    r = undo(client, t, step).json()
    assert current_step(r)["id"] == step["id"]
    assert r["status"] == started["status"] == "in_progress"


def test_step_must_belong_to_the_task(client):
    a = task_named(client, "Download insurance")
    b = task_named(client, "Pick a product")
    assert complete(client, a, current_step(b)).status_code == 404
    assert undo(client, a, current_step(b)).status_code == 404


def test_unknown_task_is_404(client):
    assert client.post("/api/tasks/9999/steps/1/complete").status_code == 404
    assert client.put("/api/tasks/9999/steps", json={"steps": []}).status_code == 404


# --- replace (step editor Save) ---------------------------------------------


def open_steps(task):
    return [s for s in task["steps"] if not s["done_at"]]


def test_replace_reorders_renames_deletes_and_adds(client, db):
    t = task_named(client, "Download insurance")  # 2 done + 3 open
    a, b, c = open_steps(t)
    r = replace(client, t, [{"id": c["id"], "text": c["text"]}, {"id": a["id"], "text": "Renamed"}, {"text": "  Brand new  "}])
    assert r.status_code == 200
    steps = r.json()["steps"]
    texts = [s["text"] for s in steps]
    assert texts[:2] == ["Log in to the HR portal", "Open Benefits → Documents"]  # done, locked first
    assert texts[2:] == [c["text"], "Renamed", "Brand new"]
    assert [s["position"] for s in steps] == [0, 1, 2, 3, 4]
    assert b["id"] not in [s["id"] for s in steps]
    assert db.get(TaskStep, b["id"]) is None  # really deleted, not orphaned


def test_replace_with_empty_list_keeps_finished_steps(client):
    t = task_named(client, "Download insurance")
    steps = replace(client, t, []).json()["steps"]
    assert len(steps) == 2 and all(s["done_at"] for s in steps)


def test_replace_rejects_finished_foreign_duplicate_and_blank(client):
    t = task_named(client, "Download insurance")
    other = task_named(client, "Pick a product")
    done_step = next(s for s in t["steps"] if s["done_at"])
    first_open = open_steps(t)[0]
    cases = [
        [{"id": done_step["id"], "text": "x"}],
        [{"id": current_step(other)["id"], "text": "x"}],
        [{"id": first_open["id"], "text": "a"}, {"id": first_open["id"], "text": "b"}],
        [{"text": "   "}],
    ]
    for steps in cases:
        assert replace(client, t, steps).status_code == 422, steps
    # Nothing changed after the rejected requests
    assert task_named(client, "Download insurance")["steps"] == t["steps"]


def test_task_with_no_steps(client):
    t = task_named(client, "Pick a product")
    empty = replace(client, t, []).json()
    assert empty["steps"] == []
    added = replace(client, empty, [{"text": "First thing"}]).json()
    assert [s["text"] for s in added["steps"]] == ["First thing"]
