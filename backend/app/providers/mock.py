import hashlib
import json
from copy import deepcopy
from typing import Any

from app.core.errors import DomainError
from app.providers.base import ExtractionProvider, ProviderInput, ProviderOutput


def mock_value(schema: dict, document_hash: str, root: dict | None = None, depth: int = 0) -> Any:
    root = root or schema
    if depth > 20:
        raise DomainError("MOCK_SCHEMA_LIMIT", "Mock schema recursion limit exceeded.")
    if "$ref" in schema:
        resolved: Any = root
        for segment in schema["$ref"][2:].split("/"):
            resolved = resolved[segment.replace("~1", "/").replace("~0", "~")]
        return mock_value(resolved, document_hash, root, depth + 1)
    if "const" in schema:
        return deepcopy(schema["const"])
    if schema.get("enum"):
        return deepcopy(schema["enum"][0])
    if "default" in schema:
        return deepcopy(schema["default"])
    if schema.get("examples"):
        return deepcopy(schema["examples"][0])
    if "anyOf" in schema or "oneOf" in schema:
        branch = (schema.get("anyOf") or schema["oneOf"])[0]
        return mock_value(branch, document_hash, root, depth + 1)
    if "allOf" in schema:
        merged = {}
        for part in schema["allOf"]:
            value = mock_value(part, document_hash, root, depth + 1)
            if isinstance(value, dict):
                merged.update(value)
        return merged
    kind = schema.get("type", "object" if "properties" in schema else "string")
    if isinstance(kind, list):
        kind = next((entry for entry in kind if entry != "null"), "null")
    seed = int(hashlib.sha256(document_hash.encode()).hexdigest()[:8], 16)
    if kind == "object":
        return {
            key: mock_value(child, document_hash + key, root, depth + 1)
            for key, child in schema.get("properties", {}).items()
        }
    if kind == "array":
        count = max(1, schema.get("minItems", 1))
        count = min(count, schema.get("maxItems", 3), 20)
        return [
            mock_value(schema.get("items", {}), document_hash + str(index), root, depth + 1)
            for index in range(count)
        ]
    if kind in {"number", "integer"}:
        value = schema.get("minimum", schema.get("exclusiveMinimum", 0) + 1)
        value = max(value, 1 + seed % 100)
        value = min(value, schema.get("maximum", value))
        if "exclusiveMaximum" in schema:
            value = min(value, schema["exclusiveMaximum"] - 1)
        if "multipleOf" in schema and schema["multipleOf"]:
            value = round(value / schema["multipleOf"]) * schema["multipleOf"]
        return int(value) if kind == "integer" else float(value)
    if kind == "boolean":
        return seed % 2 == 0
    if kind == "null":
        return None
    formats = {
        "date": "2026-01-15",
        "date-time": "2026-01-15T12:00:00Z",
        "email": "sample@example.com",
        "uri": "https://example.com/document",
        "uuid": "00000000-0000-4000-8000-000000000001",
    }
    text = formats.get(schema.get("format"), f"sample-{seed % 10000:04d}")
    minimum = schema.get("minLength", 0)
    maximum = schema.get("maxLength", max(minimum, len(text)))
    return text.ljust(minimum, "x")[:maximum]


class MockExtractionProvider(ExtractionProvider):
    def extract(self, request: ProviderInput) -> ProviderOutput:
        options = request.options
        failure_every = options.get("failure_every", 0)
        if failure_every and int(request.document_hash[:8], 16) % failure_every == 0:
            raise DomainError("MOCK_FAILURE", "This document was selected by the mock failure scenario.")
        value = mock_value(request.schema, request.document_hash)
        variant = options.get("variant", "baseline")
        if variant == "noisy" and isinstance(value, dict) and value:
            key = sorted(value)[0]
            if isinstance(value[key], str):
                value[key] += " (changed)"
            elif isinstance(value[key], (int, float)) and not isinstance(value[key], bool):
                value[key] += 2
        content: Any = value
        if options.get("response_format") == "fenced":
            content = "\x60\x60\x60json\n" + json.dumps(value) + "\n\x60\x60\x60"
        elif options.get("response_format") == "wrapped":
            content = {"data": value}
        elif options.get("response_format") == "malformed":
            content = '{"incomplete":'
        raw = {"provider": "mock", "model": request.model, "content": content}
        return ProviderOutput(content=content, raw=raw)
