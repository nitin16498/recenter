"""Recenter backend — FastAPI app.

Endpoints:
- GET  /api/health   : liveness check.
- GET  /api/messages : chat history for the UI (REC-8).
- POST /api/chat     : persist user message + assistant reply (stub until the
                       LangGraph supervisor lands in REC-9).
- GET  /api/board    : tasks grouped by status + epic/story lists (REC-27).
- PATCH /api/tasks/{id} : partial task update — drag status, detail panel edits.
"""

from dotenv import load_dotenv

load_dotenv()  # ANTHROPIC_API_KEY etc. from backend/.env — before agent imports

from app.agent import run_agent
from app.db import get_db, init_db
from app.models import Epic, Message, Story, Task, TaskStatus, utcnow
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(title="Recenter", version="0.1.0")

# Vite dev server origin. The Vite proxy makes this mostly unnecessary in dev,
# but keeping CORS explicit avoids surprises if the frontend calls us directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


class ChatRequest(BaseModel):
    content: str
    thread_id: str = "main"


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


def to_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id, role=m.role, content=m.content, created_at=m.created_at.isoformat()
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/messages")
def list_messages(thread_id: str = "main", db: Session = Depends(get_db)) -> list[MessageOut]:
    messages = (
        db.query(Message)
        .filter(Message.thread_id == thread_id)
        .order_by(Message.created_at, Message.id)
        .all()
    )
    return [to_out(m) for m in messages]


@app.post("/api/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)) -> MessageOut:
    user_msg = Message(thread_id=req.thread_id, role="user", content=req.content)
    db.add(user_msg)
    db.commit()

    # REC-9: the LangGraph supervisor routes to day_planner / habit_coach /
    # email_triage. The checkpointer holds conversation memory per thread.
    try:
        reply_text = run_agent(req.content, thread_id=req.thread_id)
    except Exception as exc:  # missing/invalid API key, network, etc.
        reply_text = (
            "I couldn't reach my brain just now — check that ANTHROPIC_API_KEY "
            f"is set in backend/.env and try again. ({type(exc).__name__})"
        )

    reply = Message(thread_id=req.thread_id, role="assistant", content=reply_text)
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return to_out(reply)


# --- Board (REC-27) -------------------------------------------------------


class TaskOut(BaseModel):
    id: int
    title: str
    first_action: str | None
    est_minutes: int | None
    status: TaskStatus
    note: str | None
    story_id: int | None
    story_title: str | None
    epic_id: int | None
    epic_name: str | None


class TaskPatch(BaseModel):
    """Only fields present in the request body are applied; null clears."""

    title: str | None = None
    first_action: str | None = None
    est_minutes: int | None = None
    status: TaskStatus | None = None
    note: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("title cannot be blank")
        return v.strip() if v is not None else v

    @field_validator("est_minutes")
    @classmethod
    def est_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("est_minutes must be positive")
        return v


class EpicOut(BaseModel):
    id: int
    name: str


class StoryOut(BaseModel):
    id: int
    title: str
    epic_id: int


class BoardOut(BaseModel):
    columns: dict[TaskStatus, list[TaskOut]]
    epics: list[EpicOut]
    stories: list[StoryOut]


def task_out(t: Task) -> TaskOut:
    story = t.story
    return TaskOut(
        id=t.id,
        title=t.title,
        first_action=t.first_action,
        est_minutes=t.est_minutes,
        status=t.status,
        note=t.note,
        story_id=t.story_id,
        story_title=story.title if story else None,
        epic_id=story.epic_id if story else None,
        epic_name=story.epic.name if story else None,
    )


@app.get("/api/board")
def get_board(db: Session = Depends(get_db)) -> BoardOut:
    tasks = (
        db.query(Task)
        .options(joinedload(Task.story).joinedload(Story.epic))
        .order_by(Task.story_id, Task.order_in_story, Task.id)
        .all()
    )
    columns: dict[TaskStatus, list[TaskOut]] = {s: [] for s in TaskStatus}
    for t in tasks:
        columns[t.status].append(task_out(t))

    epics = db.query(Epic).order_by(Epic.id).all()
    stories = db.query(Story).order_by(Story.id).all()
    return BoardOut(
        columns=columns,
        epics=[EpicOut(id=e.id, name=e.name) for e in epics],
        stories=[StoryOut(id=s.id, title=s.title, epic_id=s.epic_id) for s in stories],
    )


@app.patch("/api/tasks/{task_id}")
def patch_task(task_id: int, patch: TaskPatch, db: Session = Depends(get_db)) -> TaskOut:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    changes = patch.model_dump(exclude_unset=True)
    if "title" in changes and changes["title"] is None:
        raise HTTPException(status_code=422, detail="title cannot be null")
    if "status" in changes:
        if changes["status"] is None:
            raise HTTPException(status_code=422, detail="status cannot be null")
        if changes["status"] != task.status:
            task.completed_at = utcnow() if changes["status"] == TaskStatus.done else None

    for field, value in changes.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task_out(task)
