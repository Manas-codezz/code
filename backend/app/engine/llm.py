"""Provider-agnostic LLM client with fallback.

Groq and OpenAI share the same SDK shape; only base_url + model differ.
`candidates()` returns every keyed provider, configured one first, so the
review engine can fall through the chain on failure and land on mock."""
import logging
from ..settings import settings

log = logging.getLogger("brandguard.llm")


def candidates() -> list[tuple[object, str, str]]:
    """[(client, model, name)] — configured provider first, then others."""
    from openai import OpenAI

    prov = settings.llm_provider.lower()
    chain = [prov] + [p for p in ("groq", "openai") if p != prov]
    out = []
    for p in chain:
        if p == "groq" and settings.groq_api_key:
            out.append((OpenAI(base_url="https://api.groq.com/openai/v1",
                               api_key=settings.groq_api_key,
                               timeout=settings.llm_timeout),
                        settings.groq_model, "groq"))
        elif p == "openai" and settings.openai_api_key:
            out.append((OpenAI(api_key=settings.openai_api_key,
                               timeout=settings.llm_timeout),
                        settings.openai_model, "openai"))
        elif p == "mock":
            pass  # mock is handled by the caller, not a client
    return out


def active_name() -> str:
    prov = settings.llm_provider.lower()
    if prov == "groq" and settings.groq_api_key:
        return "groq"
    if prov == "openai" and settings.openai_api_key:
        return "openai"
    return "mock"


def active_model() -> str:
    if active_name() == "groq":
        return settings.groq_model
    if active_name() == "openai":
        return settings.openai_model
    return "n/a"


def available() -> bool:
    return bool(candidates()) or settings.llm_provider.lower() == "mock"
