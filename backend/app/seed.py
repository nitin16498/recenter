"""Seed sample data (REC-7). Run: python -m app.seed"""

from datetime import date, datetime, timezone

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
    TriggerSlot,
)


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
                first_action="List pros/cons with the coach for 10 minutes",
                est_minutes=15,
                order_in_story=1,
                status=TaskStatus.todo,
                scheduled_for=date.today(),
            ),
            Task(
                story_id=car.id,
                title="Pick a product and order it",
                first_action="Open the two links from research and compare reviews",
                est_minutes=20,
                order_in_story=2,
            ),
        ]
    )

    # REC-27: enough spread across epics/stories/statuses to exercise the Board
    # (filter chips, all three columns). Mirrors design/board-tab.html.
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
                first_action='Open the HR portal and search "insurance card"',
                est_minutes=10,
                order_in_story=1,
                status=TaskStatus.in_progress,
            ),
            Task(
                story_id=medical.id,
                title="Find what your insurance covers & where",
                first_action="Open the downloaded PDF to the coverage page",
                est_minutes=25,
                order_in_story=2,
            ),
            Task(
                story_id=medical.id,
                title="Book the hospital appointment",
                first_action="Call the clinic number from the insurance list",
                est_minutes=15,
                order_in_story=3,
            ),
            Task(
                story_id=board.id,
                title="Sketch the board layout",
                first_action="Open the mockup and list the card types",
                est_minutes=20,
                order_in_story=1,
                status=TaskStatus.done,
                completed_at=datetime.now(timezone.utc),
            ),
            Task(
                story_id=recipe.id,
                title="Pick this week's recipe",
                first_action="Open the saved-recipes folder and choose one",
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
    print("Seeded: 2 identities, 2 habits, 1 occurrence, 3 epics, 4 stories, 7 tasks.")


if __name__ == "__main__":
    seed()
