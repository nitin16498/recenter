"""Recenter backend — FastAPI app.

Endpoints:
- GET  /api/health   : liveness check.
- GET  /api/messages : chat history for the UI (REC-8).
- POST /api/chat     : persist user message + assistant reply (stub until the
                       LangGraph supervisor lands in REC-9).
"""

from dotenv import load_dotenv

load_dotenv()  # ANTHROPIC_API_KEY etc. from backend/.env — before agent imports

from app.agent import run_agent
from app.db import get_db, init_db
from app.models import Message
from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy.orm import Session
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
