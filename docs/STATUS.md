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

## REC-27 — Board tab: kanban by status with filters (2026-10-29)
**Result:** shipped (in review)
**Changed:** `backend/app/main.py`: `GET /api/board`, `PATCH /api/tasks/{id}`
(`TaskOut`/`TaskPatch` schemas); `backend/app/seed.py`: +2 epics, +3 stories,
+5 tasks; new `frontend/src/pages/Board.jsx`,
`frontend/src/components/TaskDetailPanel.jsx`, `frontend/src/tasks.js`;
`App.jsx` nav + route; `styles.css` board/panel styles + 3 tokens
(`--accent-border`, `--accent-fill`, `--border-strong`); README, overview;
`design/` mockups committed
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
