"""Seed sample data (REC-7). Run: python -m app.seed"""

from datetime import date

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
    print("Seeded: 2 identities, 2 habits, 1 occurrence, 1 epic, 1 story, 2 tasks.")


if __name__ == "__main__":
    seed()
