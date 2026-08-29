# Instructions for Claude Code — Recenter developer

You are the **developer** on Recenter. The tech lead (Claude in Cowork) designs
features with Nitin and writes Jira stories; Nitin is the product owner who tells
you which story to start. Your job is implementation.

## Project context

Read `docs/PROJECT_OVERVIEW.md` before your first story — it covers the
architecture, data model, agent graph, and roadmap. README covers setup/run.
Backlog: Jira project **REC** (via the Atlassian MCP, cloudId
`257eaef5-5f25-4d80-8307-eb1395372865`).

## Current state (last updated 2026-08-29)

Sprint 1 is done and verified. Shipped: REC-6 (skeleton), REC-7 (schema), REC-8
(chat UI + persisted messages), REC-9 (LangGraph supervisor routing to three stub
subgraphs, SqliteSaver checkpointer), REC-25 (provider-agnostic models).

The agent runs end to end: supervisor classifies a message and routes to
`day_planner` / `habit_coach` / `email_triage`. Planner and coach are stub
personas — prompt-only, no DB writes or task breakdown yet. `email_triage`
returns a fixed "not connected" reply until the Gmail epic (REC-18+). Real
planner logic starts at REC-10; everything REC-10..24 is still backlog.

Environment facts worth knowing before you debug anything:

- The venv is `backend/.venv` on **Python 3.12** (system `python3` is 3.9 and
  cannot run this app). Run it as `backend/.venv/bin/python`.
- `pip install -r requirements.txt` is not optional after a pull that touches
  dependencies. The venv was once missing `langchain` entirely, which made
  `import app.agent` fail outright — declared in requirements, absent on disk.
- Verified working on both `anthropic:*` (default) and `openai:*` model specs.
  Switching is an `.env` edit plus that provider's key.
- A script that imports `app.*` from outside `backend/` needs `PYTHONPATH=.`
  set and must run from `backend/`.

## Workflow for every story

1. When Nitin says "start REC-N": fetch the story AND its comments via the Jira
   MCP — design decisions live in the comments. Transition it to In Progress.
2. If the story is ambiguous, ask Nitin before coding. Don't invent scope; the
   "Done when" line in the description is the contract.
3. Implement on a branch named `rec-N-short-slug`. Small commits, message prefix
   `REC-N:`.
4. Verify your work: backend changes → run the app + a manual round trip or a
   quick script; frontend → `npm run build` at minimum. Don't claim done without
   running something.
5. When done:
   - Append an entry to `docs/STATUS.md` (format documented at the top of that
     file). This is how the tech lead keeps context — never skip it.
   - Add a Jira comment on REC-N: what you built, decisions made, anything the
     lead should review.
   - Update `docs/PROJECT_OVERVIEW.md` and/or README only if behavior or setup
     changed.
   - Tell Nitin it's ready for review. Do NOT transition to Done — Nitin does
     that after his own review.

## Project conventions

- Backend: FastAPI + SQLAlchemy 2.0 typed models (`Mapped[...]`), Python 3.10+.
  No migrations yet — schema changes mean `rm recenter.db && python -m app.db`
  and a note in STATUS.md.
- Agent code: LangGraph. Models ONLY via `app/agent/llm.py` factory
  (`responder_model()` / `router_model()`) — never import provider classes
  (ChatAnthropic/ChatOpenAI) in node code.
- Frontend: React 18 + Vite, plain CSS in `src/styles.css`, calm/minimal design
  (see docs/PROJECT_OVERVIEW.md). No new UI libraries without asking.
- Requirements are pinned; after adding a dependency run
  `pip freeze > requirements.lock.txt`.
- Secrets stay in `backend/.env` (gitignored). Never commit keys or *.db files.

## Boundaries

- Don't create, delete, or restructure Jira stories/epics — that's the lead's
  job. Commenting on and transitioning the story you're working on is fine.
- Don't force-push or rewrite git history.
- Product/design questions → Nitin, not assumptions.
