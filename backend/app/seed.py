"""Seed sample data (REC-7). Run: python -m app.seed"""

from datetime import date, datetime, timedelta, timezone

from app.db import SessionLocal, init_db
from app.models import (
    Epic,
    Habit,
    HabitOccurrence,
    Identity,
    MemoryFact,
    Message,
    OccurrenceStatus,
    Story,
    Task,
    TaskStatus,
    TaskStep,
    TriggerSlot,
)


def steps(*items: str | tuple[str, int]) -> list[TaskStep]:
    """Build ordered steps. A (text, minutes_ago) tuple is a finished step."""
    now = datetime.now(timezone.utc)
    out = []
    for i, item in enumerate(items):
        text, ago = item if isinstance(item, tuple) else (item, None)
        done_at = now - timedelta(minutes=ago) if ago is not None else None
        out.append(TaskStep(position=i, text=text, done_at=done_at))
    return out


def seed() -> None:
    init_db()
    db = SessionLocal()

    if db.query(Identity).count() > 0:
        print("Already seeded, skipping.")
        db.close()
        return

    engineer = Identity(statement="I am an engineer who ships projects")
    cook = Identity(statement="I am a good cook who eats healthy, interesting food")
    db.add_all([engineer, cook])
    db.flush()

    meditate = Habit(
        identity_id=engineer.id,
        name="Meditate 10 minutes",
        cue="After my first coffee",
        trigger_slot=TriggerSlot.morning,
        two_minute_version="Sit and take 5 deep breaths",
    )
    code = Habit(
        identity_id=engineer.id,
        name="Code on Recenter for 20 minutes",
        cue="After dinner, close laptop and open project repo",
        trigger_slot=TriggerSlot.evening,
        two_minute_version="Open the repo and write one line",
    )
    db.add_all([meditate, code])
    db.flush()

    db.add(
        HabitOccurrence(
            habit_id=meditate.id,
            on_date=date.today(),
            status=OccurrenceStatus.pending,
        )
    )

    life = Epic(name="Life")
    db.add(life)
    db.flush()

    car = Story(
        epic_id=life.id,
        title="Protect the car from afternoon heat",
        definition_of_done="A protection solution is bought, delivered, and in use",
    )
    db.add(car)
    db.flush()

    db.add_all(
        [
            Task(
                story_id=car.id,
                title="Decide approach: windshield reflector vs full cover",
                steps=steps("List pros/cons with the coach for 10 minutes", "Pick one and note why"),
                est_minutes=15,
                order_in_story=1,
                status=TaskStatus.todo,
                scheduled_for=date.today(),
            ),
            Task(
                story_id=car.id,
                title="Pick a product and order it",
                steps=steps("Open the two links from research", "Compare reviews side by side", "Order the winner"),
                est_minutes=20,
                order_in_story=2,
            ),
        ]
    )

    # REC-27: enough spread across epics/stories/statuses to exercise the Board
    # (filter chips, all three columns). Mirrors design/board-tab.html.
    # REC-30: several tasks are mid-way through their steps (design/task-steps.html),
    # including one paused back in To do with a step already done.
    projects = Epic(name="Projects")
    cooking = Epic(name="Cooking")
    db.add_all([projects, cooking])
    db.flush()

    medical = Story(
        epic_id=life.id,
        title="Get a medical checkup",
        definition_of_done="Checkup attended, covered by insurance",
    )
    board = Story(
        epic_id=projects.id,
        identity_id=engineer.id,
        title="Ship the Recenter board",
        definition_of_done="Board tab shows real tasks and drag updates status",
    )
    recipe = Story(
        epic_id=cooking.id,
        identity_id=cook.id,
        title="Cook one new recipe a week",
        definition_of_done="A new recipe cooked and rated this week",
    )
    db.add_all([medical, board, recipe])
    db.flush()

    db.add_all(
        [
            Task(
                story_id=medical.id,
                title="Download insurance docs from employer portal",
                steps=steps(
                    ("Log in to the HR portal", 26 * 60),
                    ("Open Benefits → Documents", 26 * 60 - 8),
                    "Download the insurance card PDF",
                    "Download the coverage summary",
                    'Save both to a "Medical" folder',
                ),
                est_minutes=10,
                order_in_story=1,
                status=TaskStatus.in_progress,
            ),
            Task(
                story_id=medical.id,
                title="Find what your insurance covers & where",
                steps=steps(
                    ("Open the coverage summary PDF", 5 * 60),
                    "Find the preventive-care section",
                    "List two in-network clinics nearby",
                ),
                est_minutes=25,
                order_in_story=2,
            ),
            Task(
                story_id=medical.id,
                title="Book the hospital appointment",
                status=TaskStatus.in_progress,
                steps=steps(
                    ("Find the clinic number on the insurance list", 3 * 60),
                    ("Pick two time slots that work", 3 * 60 - 8),
                    "Call the clinic and book one",
                ),
                est_minutes=15,
                order_in_story=3,
            ),
            Task(
                story_id=board.id,
                title="Sketch the board layout",
                steps=steps(("Open the mockup", 3 * 24 * 60), ("List the card types", 3 * 24 * 60 - 15)),
                est_minutes=20,
                order_in_story=1,
                status=TaskStatus.done,
                completed_at=datetime.now(timezone.utc),
            ),
            Task(
                story_id=recipe.id,
                title="Pick this week's recipe",
                steps=steps("Open the saved-recipes folder", "Choose one and add ingredients to the list"),
                est_minutes=10,
                order_in_story=1,
            ),
        ]
    )

    db.add(
        Message(
            role="assistant",
            content="Welcome to Recenter. Tell me who you want to become, and we'll build the habits that vote for it.",
        )
    )

    db.add(
        MemoryFact(
            subject="project",
            fact="Building Recenter as a side project to become an engineer who ships",
            source="seed",
        )
    )

    db.commit()
    db.close()
    print("Seeded: 2 identities, 2 habits, 1 occurrence, 3 epics, 4 stories, 7 tasks, 20 steps.")


if __name__ == "__main__":
    seed()
