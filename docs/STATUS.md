# Status log

Developer worklog. Claude Code appends one entry per story (newest first) so the
tech lead can catch up without re-reading the codebase.

Entry format:

```
## REC-N — <story title> (<date>)
**Result:** shipped / partial / blocked
**Changed:** files or areas touched, one line each
**Decisions:** anything decided during implementation the lead didn't specify
**For review:** open questions, risks, follow-ups worth a new story
```

---

## Sprint 2 so far: summary for the lead (2026-10-31)
**Read this first.** Much of Sprint 2's design happened directly between Nitin
and Claude Code, so here is the whole picture in one place.

**Stories**

| Story | State | Branch | What it is now |
| --- | --- | --- | --- |
| REC-27 Board tab | In review | `rec-27-board-tab` | Kanban + filters as specced, **plus two review changes from Nitin**: the detail panel became a centered modal that grows out of the card over a blurred page, and a dark mode toggle (no story of its own). |
| REC-30 Task steps (+ celebrations, settings) | In review | `rec-30-task-steps` (stacked on REC-27) | New story, **created by Claude Code with Nitin's explicit OK** (normally your job). Covers multi-step tasks, Stepper/Timeline, step editor, celebrations, Settings page, and now the regression suite + CI. |

Neither story is merged. Merge REC-27 first.

**Design decisions Nitin made (the details are in REC-30's Jira comments and
`design/task-steps.html`, whose notes record each round):**
- **Steps replace `first_action`.** A task has ordered steps, and its current
  step is the first one not done.
- **Collapsed card labels** say *First action*, *Next action* or *Last action*
  by where the current step sits. Only In progress cards show the step text,
  with a leading ring to tick it off.
- **Progress travels with the task.** A card moved back to To do keeps its
  finished steps.
- **Finishing a step on a To do task moves it to In progress.**
- **The open card shows a Stepper** (his pick) of horizontally scrolling step
  cards with side arrows. Timeline is an option in Settings.
- **Editing steps** is behind an "Edit steps" button (it's rare): hold-and-drag
  bubbles, plus a ✓ button to add.
- **Celebrations** ("atta-boy", around the card, falling confetti). Style and
  duration (0.6–5s) are in Settings; defaults are Popper + cheer, 2.0s.
- **Later, not designed yet:** points, and Oregon Trail-style travellers that
  task completion keeps alive.

**Needs your attention**
1. **REC-11's approved split-view design conflicts with the modal.** It needs
   a design pass before REC-11 starts.
2. **REC-10 should write `task_steps`**, not a first action.
3. **Possible new stories:** gamification phase 2; Alembic migrations (resets
   wipe Nitin's chat history); dark mode, retroactively; FastAPI lifespan and
   React Router v7 cleanups.
4. **Nitin's local DB was upgraded in place**, not reset, to keep his chat.
   Backup: `backend/recenter.backup-2026-10-31.db`.

**New ground rule (CLAUDE.md):** every build runs `scripts/test.sh`, new
features ship with tests, and bug fixes ship with a regression test. The same
suite gates `git push` and runs in GitHub Actions.

## REC-30 (cont.) — Regression suite, pre-push hook, CI (2026-10-31)
**Result:** shipped (in review), on `rec-30-task-steps`. Asked for by Nitin.
There's no story of its own; it sits under REC-30 because it tests REC-27/30
work.

**Changed:**
- `backend/tests/`: 36 pytest tests, with a fresh seeded temp DB per test and
  the agent stubbed.
- `frontend/src/*.test.js`: 20 Vitest tests.
- `frontend/e2e/`: 42 Playwright tests in 9 spec files, plus `helpers.js`.
- `frontend/playwright.config.js`: isolated servers on :8011/:5181.
- `scripts/test.sh` (`--quick` skips the browser tests), `.githooks/pre-push`,
  and `.github/workflows/regression.yml` (backend, frontend, then e2e jobs; no
  secrets).
- `requirements-dev.txt` (pytest); lock refreshed.
- New dev dependencies: vitest 2.1.9, @playwright/test 1.53.2.
- README Testing section, `design/README.md`, CLAUDE.md workflow and
  current-state updates.

**Decisions:**
- **Test seams are env-gated and off by default:**
  - `RECENTER_DATABASE_URL` and `RECENTER_CHECKPOINT_DB` set the DB paths.
  - `RECENTER_TESTING=1` gives canned agent replies plus
    `POST /api/_test/reset`.
  - Tests never call a model and never touch `recenter.db` or the dev servers.
- **Browser tests run serially** (`workers: 1`) and re-seed before each test,
  because they share one backend DB. A full run takes about 40s, and it was
  stable over three consecutive runs.
- **The pre-push hook runs the full suite, not `--quick`,** so UI regressions
  can't slip through. `git push --no-verify` is the escape hatch.
- **A known FastAPI `on_event` deprecation warning is filtered** in
  `pytest.ini`. It predates this work.

**For review:**
- **Bug the suite caught:** quick repeated ←/→ presses or arrow clicks in the
  Stepper only moved one step, because the next target was computed from the
  slide in view mid-glide. Fixed in `cb8d0a9`, and covered by the stepper
  spec.
- **The empty-steps crash** from earlier today is now a regression test, in
  both views.
- **GitHub Actions is verified.** The first run on `rec-30-task-steps` (run
  41244123111, 2026-10-31) was all green: backend, frontend, and browser tests
  in about 3 minutes. `gh` is now installed and logged in as nitin16498, so
  Claude Code can read CI results (`gh run list`, `gh run view --log-failed`).
- **`main` is protected (2026-10-31).** Nitin made the repo public, which
  allows branch protection on the free plan. Merging into `main` now requires
  the three Regression checks to pass: "Backend tests", "Frontend unit tests +
  build" and "Browser tests". Force-pushes and branch deletion are blocked.
  Admins (Nitin) can still override in an emergency.
- **Before going public, git history was scanned for secrets.** No `.env` or
  `*.db` files were ever committed, and there are no API-key patterns. Keep
  it that way: secrets only in `backend/.env`.
- **Not covered by automated tests:** how the celebrations look (only that
  they start and clean up) and touch gestures (Chromium desktop only).

## REC-30 — Task steps, stepper/timeline, celebrations, settings (2026-10-31)
**Result:** shipped (in review). Branch `rec-30-task-steps`, built on `rec-27-board-tab`.
**Story:** created by Claude Code at Nitin's explicit OK, because the design
happened directly with Nitin over seven prototype rounds
(`design/task-steps.html`). Lead: please review the story's scope.
**Changed:**
- `models.py`: new `TaskStep` model; dropped `Task.first_action`.
- `main.py`: `TaskOut.steps`; complete, undo and replace-steps endpoints.
- `seed.py`: 20 steps, with tasks partway through.
- Frontend:
  - new `fx.js`, `settings.js`, `pages/Settings.jsx`, `StepStepper.jsx`,
    `StepTimeline.jsx`, `StepEditor.jsx`, `UndoToast.jsx`
  - rewritten steps section in `TaskDetailModal.jsx`
  - Board ring, labels and progress
  - `/settings` route and sidebar link
  - styles
- README, overview, and the prototype in `design/`.

**Schema change:** `rm recenter.db && python -m app.seed`. This also wipes chat
history, so Nitin's local DB has **not** been touched.

**Decisions:**
- **`first_action` is gone, not kept alongside steps.** Two sources of truth
  for "what's next" would drift. The planner (REC-10) should write steps.
- **"Current step" isn't stored.** It's the first step without `done_at`.
  Labels (First / Next / Last action) are derived on the client by position.
- **Complete moves To do → In progress server side**, so every client gets the
  same rule. Undoing that from the toast reverts the status explicitly.
- **The replace-steps endpoint takes the open steps only.** Finished steps stay
  locked at the front: you can't rename, move or delete them there. A done or
  foreign id, a duplicate, or blank text gets a 422. Open steps left out of
  the list are deleted (delete-orphan).
- **Settings are per browser** (localStorage), like the theme. Defaults are
  Stepper, Popper + cheer and 2.0s, as Nitin approved. They'd move to the
  backend if this ever goes multi-device.
- **Celebration colors are a fixed palette**, not theme tokens, since they need
  to read in both themes. They're the only hex values outside `:root`.

**For review:**
- **Verified** in a headless browser against a scratch DB:
  - ring tick, celebration, toast and undo
  - a forward drag celebrates
  - stepper arrows, ←/→, mouse-drag scroll and dots
  - Mark done through to the last-step prompt, then Move to Done
  - a To do task auto-starts, and undo puts it back
  - editor drag-reorder, rename, delete and add; Esc cancels only the editor;
    Save persists in the right order
  - Settings persist across reload, Off disables the slider and plays nothing,
    and Timeline applies to the open card
  - dark mode
  - No console errors. The only warnings are React Router's v7 future flags,
    which were already there.
  - The API was tested separately, including the 422 and 404 cases.
- **Fixed after Nitin hit it (2026-10-31):** opening a card for a task with
  no steps crashed the whole app, leaving a dark, empty screen. Stepper's
  scroll-listener effect assumed the strip existed, and Nitin's pre-REC-30 DB
  has tasks with no steps. The effect is now guarded. The modal also sits
  inside an `ErrorBoundary`, so any future render error closes the card with
  a message instead of blanking the app.
- **REC-11 impact:** chat cards can reuse the modal, the steps components and
  `fx.js`. The earlier split-view question still stands (see REC-27).
- **Not built**, per the story's out-of-scope list:
  - points and the "Oregon Trail" travellers (Nitin wants a separate design
    pass)
  - sound
  - drag reordering of steps on touch: it works, but scrolling the list while
    holding is blocked (`touch-action: none`)

## REC-27 — Board tab: kanban by status with filters (2026-10-29)
**Result:** shipped (in review)
**Changed:** `backend/app/main.py`: `GET /api/board`, `PATCH /api/tasks/{id}`
(`TaskOut`/`TaskPatch` schemas); `backend/app/seed.py`: +2 epics, +3 stories,
+5 tasks; new `frontend/src/pages/Board.jsx`,
`frontend/src/components/TaskDetailModal.jsx`, `frontend/src/tasks.js`,
`frontend/src/theme.js`; `App.jsx` nav + route + theme toggle; `index.html`
pre-paint theme script; `styles.css` board/modal styles, new tokens, dark
palette; README, overview; `design/` mockups committed
**Decisions:**
- No schema change. The seed now covers Life/Projects/Cooking, with tasks in
  all three statuses (mirrors the mockup), because 1 epic and 2 to-do tasks
  couldn't exercise the filters or columns. Existing DBs aren't re-seeded: run
  `rm recenter.db && python -m app.seed` to see it.
- `/api/board` returns `{columns: {todo, in_progress, done}, epics, stories}`.
  Epic/story lists come back separately so chips don't depend on which tasks
  exist. Filtering is client-side (single user, small data).
- PATCH semantics: only fields present in the body are applied; `null` clears
  optional fields. A blank title or a null title/status gets a 422. Status
  transitions maintain `completed_at`.
- Panel saves each field on blur (status on change). There's no Save button, per
  "Edits save directly" in the mockup. A blank title reverts instead of saving.
- Habits toggle is a stub: the toggle state works and cards with `kind: "habit"`
  get the dashed style, but no habit cards come from the API yet. "By story" is
  rendered disabled.
- Story chips show the selected epic's stories (all stories when epic = All).
  Picking an epic resets the story filter.
- DnD is native HTML5, no new dependency. In-column order follows the server
  (story, then order_in_story), so a dropped card lands in its story order, not
  at the drop position.
**For review:**
- Verified with an API script (grouping, joins, partial patch, null-clear,
  422/404, completed_at) and a headless-browser run against a scratch DB:
  filters, drag To do→In progress→Done persisted, panel edits persisted, blank
  title reverted, no console errors. `npm run build` passes.
- No reordering within a column (no API for `order_in_story`). Probably a
  follow-up if it matters.
- Habit-card data shape (`kind`, `trigger_slot`) is my guess; the habit
  occurrences story should confirm it or change it.

**Review round 1 (Nitin, 2026-10-29): two changes requested**
- **Detail view is now a centered modal, not a side panel.** This departs from
  the approved `task-split-view.html` at Nitin's request. The card grows out of
  the clicked card (a FLIP animation via the Web Animations API, with a fade
  fallback for prefers-reduced-motion) over a blurred, dimmed page. It closes on
  Esc, ×, or a click outside, and closing blurs the focused field first, so an
  in-progress edit still saves. Status is now a segmented control instead of a
  select. `TaskDetailPanel` was renamed to `TaskDetailModal`.
  **Lead: REC-11's design assumed chat cards on the left with this panel on the
  right ("Discussing: card N"). With a modal, that split view needs
  rethinking. Worth a session with Nitin before REC-11 starts.**
- **Dark mode with a sidebar toggle.** There's no story for it; it's done on
  this branch in its own commit (`REC-27: dark mode…`) so it can be split out.
  It uses token overrides, the saved choice or the OS setting, and a pre-paint
  script so the page doesn't flash light. All remaining hex values in
  styles.css are now tokens (`--danger`, `--on-accent`, `--knob`, `--scrim`,
  `--shadow-lg`).
- Fixed a dev-only bug found while verifying: StrictMode's double effect run
  overrode the grow animation, so effect cleanup now cancels it.
- Verified in a headless browser: grow starts exactly at the clicked card's
  rect, Esc saved a pending note, backdrop click closes, a status change from
  the modal moves the card, the theme persists across reload and follows the OS
  dark setting when nothing is saved, no console errors. `npm run build` passes.

## REC-25 — Provider-agnostic model config (2026-08-28, verified 2026-08-29)
**Result:** shipped and verified
**Changed:** new `backend/app/agent/llm.py` (init_chat_model factory); `graph.py`
refactored to use it; requirements + .env.example + docs updated;
`requirements.lock.txt` refreshed (2026-08-29); `.env.example` rewritten with
per-provider key guidance; README key note + langchain troubleshooting entry
**Decisions:** `provider:model` spec strings; lru_cache per spec; defaults
anthropic:claude-sonnet-4-5 / claude-haiku-4-5. Lock file left as a full
`pip freeze` per convention, so it also carries dev-only langgraph-cli/api/sdk.
**For review:**
- The venv was missing `langchain` and `langchain-openai` entirely — `import
  app.agent` raised `ModuleNotFoundError: No module named 'langchain'`, i.e. the
  backend could not start. Declared-but-not-installed; fixed by
  `pip install -r requirements.txt`. The old lock predated REC-9 and contained
  none of the agent stack, so anyone installing from it got a dead backend.
- Live smoke test now passes on `openai:gpt-4o` / `gpt-4o-mini`: all three routes
  classified correctly, both stub personas honored their prompts, and the
  SqliteSaver checkpointer recalled turn 1 on a second invoke. Anthropic defaults
  unaffected.
- Version drift worth a look: ranges resolved to majors (langgraph 1.2.11,
  langchain 1.3.18, langchain-anthropic 1.5.6). Working, but the ranges no longer
  constrain much — possible follow-up story to pin them.

## REC-9 — LangGraph supervisor (2026-08-17, revised 2026-08-27)
**Result:** shipped (lead-built, pre-workflow; Nitin added type-safety fixes)
**Changed:** `backend/app/agent/graph.py` (supervisor + 3 stub nodes,
SqliteSaver checkpointer); `/api/chat` invokes agent with fallback
**Decisions:** structured-output routing; email_triage is a fixed reply until
Gmail; checkpoints.db separate from recenter.db
**For review:** —

## REC-6/7/8 — Skeleton, schema, chat (2026-08-16..17)
**Result:** shipped (lead-built, pre-workflow)
**Changed:** full app scaffold; see docs/PROJECT_OVERVIEW.md
**Decisions:** recorded as Jira comments on each story
**For review:** —
