from app.core.config import get_settings
from app.core.errors import DomainError
from app.providers.anthropic import AnthropicExtractionProvider
from app.providers.base import ExtractionProvider
from app.providers.mock import MockExtractionProvider
from app.providers.openai import OpenAIExtractionProvider

PROVIDERS = {
    "mock": MockExtractionProvider,
    "openai": OpenAIExtractionProvider,
    "anthropic": AnthropicExtractionProvider,
}


def get_provider(name: str) -> ExtractionProvider:
    if name not in PROVIDERS:
        raise DomainError("UNKNOWN_PROVIDER", "The selected provider is not supported.")
    return PROVIDERS[name]()


def provider_availability() -> dict[str, bool]:
    settings = get_settings()
    return {
        "mock": True,
        "openai": bool(settings.openai_api_key),
        "anthropic": bool(settings.anthropic_api_key),
    }
