"""LangGraph supervisor skeleton (REC-9).

The core LangGraph ideas, mapped to this file:

- STATE: `AgentState` — the message history plus a `route` field. Every node
  receives the state and returns a partial update that LangGraph merges in.
- NODES: plain functions. `supervisor` classifies the latest user message;
  `day_planner` / `habit_coach` / `email_triage` produce the reply. Each is a
  stub persona for now — their real logic lands in their own stories
  (REC-10..14 planner, REC-15..17 coach, REC-18..21 triage).
- EDGES: START -> supervisor, then a CONDITIONAL edge reads `route` from state
  to pick the subgraph. Subgraphs end the run.
- CHECKPOINTER: SqliteSaver persists state per thread_id, giving the agent its
  recent-window conversation memory across HTTP requests (see REC-22 design:
  this is context layer 1 of 3).

Env: ANTHROPIC_API_KEY required. Models overridable via RECENTER_MODEL /
RECENTER_ROUTER_MODEL.
"""

import os
import sqlite3
from functools import lru_cache
from typing import Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

RESPONDER_MODEL = os.getenv("RECENTER_MODEL", "claude-sonnet-4-5")
ROUTER_MODEL = os.getenv("RECENTER_ROUTER_MODEL", "claude-haiku-4-5")

CHECKPOINT_DB = os.getenv("RECENTER_CHECKPOINT_DB", "checkpoints.db")


class AgentState(MessagesState):
    """MessagesState gives us `messages` with append semantics; we add `route`."""

    route: str


class Route(BaseModel):
    """Structured output for the supervisor's routing decision."""

    destination: Literal["day_planner", "habit_coach", "email_triage"] = Field(
        description="Which subgraph should handle the user's message."
    )


ROUTER_SYSTEM = """You are the router for Recenter, a personal AI chief of staff.
Classify the user's latest message into exactly one destination:

- day_planner: tasks, to-dos, planning the day, procrastination, breaking down
  big/vague work ("I need to set up CI/CD", "help me plan tomorrow").
- habit_coach: habits, identity, motivation, streaks, feeling off-track,
  meditation/exercise/routine talk, Atomic Habits topics.
- email_triage: anything about email, inbox, or the morning digest.

Default to habit_coach for greetings and general conversation."""


PLANNER_SYSTEM = """You are Recenter's day planner (stub version — full breakdown
logic arrives in a later story). Persona: pragmatic, anti-procrastination.
Acknowledge the task or plan the user mentioned, ask AT MOST one clarifying
question, and remind them that the smallest first physical action is what
matters. Keep replies under 120 words."""

COACH_SYSTEM = """You are Recenter's habit coach (stub version — cheat-sheet
principles arrive in a later story). Persona: warm, brief, identity-focused,
in the spirit of Atomic Habits: actions are votes for an identity, shrink the
habit when resistance is high, never miss twice, no guilt trips.
Keep replies under 120 words."""


@lru_cache(maxsize=1)
def _responder() -> ChatAnthropic:
    return ChatAnthropic(model_name=RESPONDER_MODEL, timeout=None, stop=None)


@lru_cache(maxsize=1)
def _router() -> ChatAnthropic:
    return ChatAnthropic(model_name=ROUTER_MODEL, timeout=None, stop=None)


def supervisor(state: AgentState) -> dict:
    raw_decision = _router().with_structured_output(Route).invoke(
        [{"role": "system", "content": ROUTER_SYSTEM}, *state["messages"]]
    )
    decision = (
        raw_decision
        if isinstance(raw_decision, Route)
        else Route.model_validate(raw_decision)
    )
    return {"route": decision.destination}


def route_from_supervisor(state: AgentState) -> str:
    return state["route"]


def day_planner(state: AgentState) -> dict:
    reply = _responder().invoke(
        [{"role": "system", "content": PLANNER_SYSTEM}, *state["messages"]]
    )
    return {"messages": [reply]}


def habit_coach(state: AgentState) -> dict:
    reply = _responder().invoke(
        [{"role": "system", "content": COACH_SYSTEM}, *state["messages"]]
    )
    return {"messages": [reply]}


def email_triage(state: AgentState) -> dict:
    # No Gmail connection yet (REC-18) — honest fixed reply, no LLM call needed.
    return {
        "messages": [
            {
                "role": "assistant",
                "content": (
                    "Email triage isn't connected yet — Gmail integration is a "
                    "later story on the board. Soon I'll read your overnight inbox "
                    "and bring you only what matters."
                ),
            }
        ]
    }


@lru_cache(maxsize=1)
def get_agent():
    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("day_planner", day_planner)
    builder.add_node("habit_coach", habit_coach)
    builder.add_node("email_triage", email_triage)

    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "day_planner": "day_planner",
            "habit_coach": "habit_coach",
            "email_triage": "email_triage",
        },
    )
    builder.add_edge("day_planner", END)
    builder.add_edge("habit_coach", END)
    builder.add_edge("email_triage", END)

    conn = sqlite3.connect(CHECKPOINT_DB, check_same_thread=False)
    return builder.compile(checkpointer=SqliteSaver(conn))


def run_agent(content: str, thread_id: str = "main") -> str:
    """Invoke the graph with one user message; return the assistant reply text."""
    # build a properly-typed AgentState for the graph invocation
    initial_state = AgentState(messages=[HumanMessage(content=content)], route="")
    result = get_agent().invoke(
        initial_state,
        config={"configurable": {"thread_id": thread_id}},
    )
    return result["messages"][-1].content
