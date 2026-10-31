"""GET /api/board (REC-27) including steps (REC-30)."""

from tests.conftest import all_tasks, current_step, task_named


def test_board_groups_tasks_by_status(client):
    board = client.get("/api/board").json()
    assert set(board["columns"]) == {"todo", "in_progress", "done"}
    counts = {k: len(v) for k, v in board["columns"].items()}
    assert counts == {"todo": 4, "in_progress": 2, "done": 1}
    for status, tasks in board["columns"].items():
        assert all(t["status"] == status for t in tasks)


def test_board_lists_epics_and_stories(client):
    board = client.get("/api/board").json()
    assert [e["name"] for e in board["epics"]] == ["Life", "Projects", "Cooking"]
    assert len(board["stories"]) == 4
    epic_ids = {e["id"] for e in board["epics"]}
    assert all(s["epic_id"] in epic_ids for s in board["stories"])


def test_tasks_carry_story_and_epic_names(client):
    t = task_named(client, "Download insurance")
    assert t["story_title"] == "Get a medical checkup"
    assert t["epic_name"] == "Life"
    assert t["epic_id"] is not None and t["story_id"] is not None


def test_tasks_have_ordered_steps_not_first_action(client):
    for t in all_tasks(client):
        assert "first_action" not in t
        positions = [s["position"] for s in t["steps"]]
        assert positions == list(range(len(positions)))


def test_seeded_progress(client):
    dl = task_named(client, "Download insurance")
    assert sum(1 for s in dl["steps"] if s["done_at"]) == 2
    assert current_step(dl)["text"] == "Download the insurance card PDF"

    book = task_named(client, "Book the hospital")
    assert book["status"] == "in_progress"
    assert current_step(book) == book["steps"][-1]  # sits on its last action

    paused = task_named(client, "Find what your insurance")
    assert paused["status"] == "todo"
    assert sum(1 for s in paused["steps"] if s["done_at"]) == 1

    done = task_named(client, "Sketch the board")
    assert current_step(done) is None
