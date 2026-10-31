# Recenter

A chat-first AI chief of staff: habit coach (Atomic Habits principles), day planner
with anti-procrastination task breakdown, and Gmail morning triage.

Built as a personal v1 on localhost. Backlog lives in Jira (REC project).
Architecture, data model, and a deep dive on the agent graph:
**[docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)**.

## Stack

- **Frontend:** React 18 + Vite 5 (`frontend/`) — dev server on port **5173**
- **Backend:** FastAPI + SQLAlchemy/SQLite (`backend/`) — API on port **8000**
- **Agents:** LangGraph — supervisor routing to `day_planner`, `habit_coach`, `email_triage` subgraphs (from REC-9)

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| **Python** | **3.10 or newer** (3.12 recommended) | `python3 --version` |
| **Node.js** | 18 or newer | `node --version` |
| npm | ships with Node | `npm --version` |

> **Python 3.10+ is a hard requirement, not a suggestion.**
> `backend/app/models.py` uses PEP 604 union syntax (`Mapped[int | None]`), which
> SQLAlchemy evaluates at import time. On Python 3.9 the backend dies immediately
> with `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`.
>
> macOS ships Python **3.9**, so `python3 -m venv` on a stock Mac creates a venv
> that cannot run this app. Install a newer one and name it explicitly:
>
> ```bash
> brew install python@3.12          # then use python3.12 below
> ```
>
> `backend/.python-version` pins 3.12 for pyenv users.

## First-time setup

Clone, then set up each half once:

```bash
# Backend
cd backend
python3.12 -m venv .venv                   # NOT plain python3 on macOS — see above
source .venv/bin/activate                  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt        # test tools (pytest)
cp .env.example .env                       # then paste your ANTHROPIC_API_KEY into .env
python -m app.db                           # create SQLite tables
python -m app.seed                         # optional: sample identities/habits/tasks
```

> The agent needs an API key in `backend/.env` (gitignored). Without one the app
> runs but every chat reply is the "couldn't reach my brain" fallback.
>
> Which key depends on the provider you pick. Since REC-25 the models are
> provider-agnostic: `RECENTER_MODEL` and `RECENTER_ROUTER_MODEL` take
> `provider:model` strings and are built through `app/agent/llm.py`. Defaults are
> `anthropic:claude-sonnet-4-5` (responder) and `anthropic:claude-haiku-4-5`
> (router), so `ANTHROPIC_API_KEY` alone is enough out of the box. To run on
> OpenAI instead, set `OPENAI_API_KEY` and add to `.env`:
>
> ```
> RECENTER_MODEL=openai:gpt-4o
> RECENTER_ROUTER_MODEL=openai:gpt-4o-mini
> ```
>
> That is the whole switch — no code change, since no node imports a provider
> class. Any LangChain provider works if its integration package is installed
> (anthropic and openai both ship in `requirements.txt`). Optional LangSmith
> tracing vars are documented in `.env.example`.

```bash
# Frontend
cd frontend
npm install                                # uses package-lock.json — same versions everywhere
npx playwright install chromium            # browser for the UI tests (one-time download)
```

Then turn on the pre-push hook, once per clone, so the regression suite runs
before every push (see [Testing](#testing)):

```bash
git config core.hooksPath .githooks
```

Verify the interpreter before installing — this is the one step that catches the
version trap early:

```bash
.venv/bin/python --version                 # must print 3.10.x or higher
```

## Quick start (already set up once)

Everything installed before? This is the whole morning routine — two terminals:

```bash
# Terminal 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173 and chat. Re-run installs only when the dependency
files changed since your last pull:

```bash
git pull
# if backend/requirements.txt changed:
cd backend && source .venv/bin/activate && pip install -r requirements.txt
# if frontend/package-lock.json changed:
cd frontend && npm install
```

Schema changed in `models.py`? There are no migrations yet (single user, no real
data). Recreate the DB with `cd backend && rm -f recenter.db && python -m app.seed`.
This also deletes your chat history, so back up `recenter.db` first if you
want to keep it.
Agent acting confused about past conversations? Its thread memory lives in
`checkpoints.db` — delete it for a fresh-brain start.

## Run locally

Two terminals, both must be running.

**Terminal 1 — backend:**

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**. The Coach tab loads chat history and you can send a
message; if the backend is down it shows *"Backend not running — start uvicorn and
refresh."* The Board tab shows tasks as a kanban (drag between columns, click a
card to edit it); run `python -m app.seed` first if you want sample tasks on it.
Interactive API docs are at **http://localhost:8000/docs**.

Vite proxies `/api/*` to `localhost:8000` (see `frontend/vite.config.js`), so the
frontend calls `fetch('/api/...')` with no CORS setup in dev.

### Reproducing the exact environment

`requirements.txt` pins direct dependencies. For a byte-identical install
(all transitives pinned too), use the lock file instead:

```bash
pip install -r requirements.lock.txt
```

Regenerate it after changing dependencies:

```bash
pip freeze > requirements.lock.txt
```

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness check → `{"status":"ok"}` |
| GET | `/api/messages` | Chat history for a thread (`?thread_id=main`) |
| POST | `/api/chat` | Persist user message, run the LangGraph agent, return + persist the reply |
| GET | `/api/board` | Tasks grouped by status (`todo`/`in_progress`/`done`) with story/epic names, plus epic and story lists |
| PATCH | `/api/tasks/{id}` | Partial task update (`title`, `est_minutes`, `status`, `note`); `null` clears optional fields |
| POST | `/api/tasks/{id}/steps/{step_id}/complete` | Mark a step done; a To do task moves to In progress |
| POST | `/api/tasks/{id}/steps/{step_id}/undo` | Mark a step not done |
| PUT | `/api/tasks/{id}/steps` | Replace the open steps in order (`{"steps": [{"id"?, "text"}]}`); finished steps are locked |

Quick smoke test with the backend running:

```bash
curl localhost:8000/api/health
curl -X POST localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"content":"hello"}'
curl localhost:8000/api/messages
```

## Testing

One command runs the whole regression suite. It must pass before anything is
pushed:

```bash
scripts/test.sh           # everything, ~45s
scripts/test.sh --quick   # skip the browser tests, ~3s, for quick iteration
```

| Layer | Tool | Where | Covers |
| --- | --- | --- | --- |
| Backend | pytest | `backend/tests/` | every endpoint: chat (agent stubbed), board, task PATCH, step complete/undo/replace, validation, seed |
| Frontend logic | Vitest | `frontend/src/*.test.js` | step helpers and First/Next/Last labels, settings store, API helpers |
| Build | Vite | — | `npm run build` must succeed |
| User flows | Playwright | `frontend/e2e/*.spec.js` | navigation and chat, board and filters and drag, ring check and undo, task card, Stepper, Timeline, step editor, Settings, dark mode, reduced motion, and the empty-steps crash |

**Isolation.**
- Tests never touch `backend/recenter.db` or your running dev servers.
- pytest uses a throwaway database per test.
- Playwright starts its own backend on :8011 (with `RECENTER_TESTING=1`, a
  throwaway `e2e-test.db`, and canned agent replies) and its own frontend on
  :5181. Each test starts from freshly seeded data.
- No API keys are needed, and no AI calls are made.

**Automatic runs.**
- *On your machine:* `.githooks/pre-push` runs `scripts/test.sh` before every
  `git push` (enable it with `git config core.hooksPath .githooks`). Skip it in
  an emergency with `git push --no-verify`.
- *On GitHub:* `.github/workflows/regression.yml` runs three jobs on every push
  and pull request: backend, frontend unit + build, and browser tests (after
  the other two pass). If the browser tests fail, the Playwright report is
  attached to the run as an artifact. Check results from the terminal with
  `gh run list` / `gh run view --log-failed`.
- *Blocking merges:* not set up, because branch protection on a private repo
  needs GitHub Pro. If the repo moves to Pro, require the three Regression
  checks on `main` (Settings → Branches).

**Running pieces on their own:**

```bash
cd backend && .venv/bin/python -m pytest                 # backend
cd frontend && npm test                                   # unit
cd frontend && npm run test:e2e                           # browser tests
cd frontend && npx playwright test e2e/editor.spec.js     # one file
cd frontend && npx playwright test --ui                   # watch them run, step by step
```

**Adding tests.** New features come with tests in the same change, and bug
fixes come with a test that would have caught the bug. Browser tests import
`test` from `e2e/helpers.js`, which resets the data before each test.

## Troubleshooting

**`TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`**
Your venv is on Python 3.9. Rebuild it on 3.10+:

```bash
cd backend && rm -rf .venv
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**`[Errno 48] address already in use` on port 8000**
Something else holds the port. Find and stop it:

```bash
sudo lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Or run the backend elsewhere (`--port 8001`) and update the `target` in
`frontend/vite.config.js` to match.

**Coach tab shows "Backend not running — start uvicorn and refresh."**
The backend isn't running, or isn't on 8000. Confirm with
`curl localhost:8000/api/health`, then reload the page.

**`ModuleNotFoundError: No module named 'app'`**
Run uvicorn from the `backend/` directory, not from the repo root or `backend/app/`.

**`ModuleNotFoundError: No module named 'langchain'`** (or `langchain_openai`)
Your venv is missing the agent stack — `langchain` provides `init_chat_model`,
which `app/agent/llm.py` imports at startup, so the backend cannot boot without
it. Reinstall from the declared set:

```bash
cd backend && source .venv/bin/activate && pip install -r requirements.txt
```

Verify with `pip list | grep -i langchain` — you want `langchain`,
`langchain-core`, `langchain-anthropic`, and `langchain-openai` all present.

**Want a clean database?**
`recenter.db` is gitignored and recreated on startup:

```bash
cd backend && rm -f recenter.db && python -m app.db
```

The seed skips a DB that already has data, so to pick up new sample data run
`rm -f recenter.db && python -m app.seed`.

**After pulling REC-30 (task steps):** this is a schema change. Tasks now have a
`task_steps` table instead of a `first_action` column. Recreate the DB with
`rm -f recenter.db && python -m app.seed`. Note that this also deletes your chat
history.

## Structure

```
frontend/src/main.jsx           React entry point
frontend/src/App.jsx            app shell: sidebar nav + routes
frontend/src/pages/Coach.jsx    chat UI
frontend/src/pages/Board.jsx    kanban board: filters, drag to change status, tick the current step
frontend/src/pages/Settings.jsx steps view, celebration style and duration
frontend/src/components/TaskDetailModal.jsx  reusable task editor modal (Board now, chat cards in REC-11)
frontend/src/components/Step*.jsx  steps as Stepper / Timeline, and the step editor
frontend/src/components/UndoToast.jsx  "Done: … · Undo" toast
frontend/src/fx.js              celebrations (confetti / sparks / popper)
frontend/src/settings.js        user settings store (localStorage) + useSettings()
frontend/src/theme.js           light/dark theme hook (sidebar toggle)
frontend/src/tasks.js           shared task helpers: statuses, step helpers, task/step API calls
frontend/src/pages/Placeholder.jsx  stubs for Today/Identity/Progress
frontend/vite.config.js         dev server + /api proxy to :8000

backend/app/main.py             FastAPI app: /api/health, /api/messages, /api/chat, /api/board, /api/tasks/{id}[/steps]
backend/app/agent/graph.py      LangGraph supervisor + subgraph nodes (see docs/PROJECT_OVERVIEW.md)
backend/app/models.py           SQLAlchemy models — identities, habits, epics/stories/tasks/steps, messages, memory
backend/app/db.py               engine, session factory, init_db()
backend/app/seed.py             sample data — python -m app.seed
backend/.env.example            template for .env (ANTHROPIC_API_KEY, model overrides, LangSmith)
backend/requirements.txt        direct dependencies (pinned)
backend/requirements-dev.txt    test-only dependencies (pytest)
backend/tests/                  pytest suite (fresh seeded DB per test, agent stubbed)
frontend/e2e/                   Playwright browser tests + helpers.js
frontend/playwright.config.js   starts the isolated test backend (:8011) and frontend (:5181)
scripts/test.sh                 the regression suite: backend + unit + build + browser
.githooks/pre-push              runs scripts/test.sh before every push
.github/workflows/regression.yml  same suite on GitHub for every push and PR
design/                         approved HTML mockups and prototypes (see design/README.md)
backend/requirements.lock.txt   full resolved dependency set

docs/PROJECT_OVERVIEW.md        architecture, data model, agent graph deep dive, roadmap
```

Runtime files (gitignored): `backend/recenter.db` (app data),
`backend/checkpoints.db` + `-shm`/`-wal` (agent thread memory).
