"""Recenter backend — FastAPI app (REC-6 skeleton).

Endpoints:
- GET /api/health : liveness check, used by the frontend to prove wiring.
- POST /api/chat  : stub echo endpoint; replaced by the LangGraph supervisor in REC-9.
"""

from fastapi import FastAPI
from pydantic import BaseModel
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


class ChatMessage(BaseModel):
    content: str


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/chat")
def chat(message: ChatMessage) -> dict:
    # Stub: echoes until the LangGraph supervisor (REC-9) takes over.
    return {"role": "assistant", "content": f"(stub) You said: {message.content}"}
