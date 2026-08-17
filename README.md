# Recenter

A chat-first AI chief of staff: habit coach (Atomic Habits principles), day planner
with anti-procrastination task breakdown, and Gmail morning triage.

Built as a personal v1 on localhost. Backlog lives in Jira (REC project).

## Stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** FastAPI + SQLAlchemy/SQLite (`backend/`)
- **Agents:** LangGraph — supervisor routing to `day_planner`, `habit_coach`, `email_triage` subgraphs (from REC-9)

## Run locally

Backend (terminal 1):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Coach tab shows "Backend: connected" when both are up.

## Structure

```
frontend/src/App.jsx        app shell: sidebar nav + routes
frontend/src/pages/         Coach (chat), placeholders for Today/Identity/Progress
backend/app/main.py         FastAPI: /api/health, stub /api/chat
```
