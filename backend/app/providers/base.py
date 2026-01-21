from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class ProviderInput:
    document_hash: str
    filename: str
    schema: dict[str, Any]
    pages: list[bytes]
    text: str
    model: str
    options: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderOutput:
    content: Any
    raw: dict[str, Any]
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost: Decimal = Decimal("0")


class ExtractionProvider(ABC):
    @abstractmethod
    def extract(self, request: ProviderInput) -> ProviderOutput:
        raise NotImplementedError


def estimate_cost(input_tokens: int, output_tokens: int, options: dict) -> Decimal:
    input_rate = Decimal(str(options.get("input_cost_per_million", 0)))
    output_rate = Decimal(str(options.get("output_cost_per_million", 0)))
    return (input_tokens * input_rate + output_tokens * output_rate) / Decimal("1000000")
