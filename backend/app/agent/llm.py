"""Model factory (REC-25) — provider-agnostic chat models.

Models are configured as "provider:model" strings in env and instantiated
through LangChain's `init_chat_model`, so no agent code ever imports a
provider-specific class. Switching providers is an .env edit:

    RECENTER_MODEL=anthropic:claude-sonnet-4-5     (default responder)
    RECENTER_ROUTER_MODEL=anthropic:claude-haiku-4-5
    # or
    RECENTER_MODEL=openai:gpt-4o
    RECENTER_ROUTER_MODEL=openai:gpt-4o-mini

The matching API key must be set (ANTHROPIC_API_KEY / OPENAI_API_KEY / ...).
Any provider LangChain supports works if its integration package is installed
(langchain-anthropic and langchain-openai are in requirements).

Bare model names without a provider prefix ("claude-sonnet-4-5") still work —
init_chat_model infers the provider from the name.
"""

import os
from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

DEFAULT_RESPONDER = "anthropic:claude-sonnet-4-5"
DEFAULT_ROUTER = "anthropic:claude-haiku-4-5"


@lru_cache(maxsize=None)
def _build(spec: str) -> BaseChatModel:
    return init_chat_model(spec)


def responder_model() -> BaseChatModel:
    """The model that writes replies (planner/coach personas)."""
    return _build(os.getenv("RECENTER_MODEL", DEFAULT_RESPONDER))


def router_model() -> BaseChatModel:
    """The small/fast model used for routing decisions."""
    return _build(os.getenv("RECENTER_ROUTER_MODEL", DEFAULT_ROUTER))
