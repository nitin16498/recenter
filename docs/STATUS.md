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
