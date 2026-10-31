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
