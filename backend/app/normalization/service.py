import json
import math
import re
from dataclasses import dataclass
from typing import Any

from app.core.errors import DomainError
from app.validation.schema import check_json_limits


@dataclass
class NormalizedOutput:
    value: Any
    warnings: list[dict[str, str]]


def normalize_response(raw: str | dict | list | None, definition: dict) -> NormalizedOutput:
    warnings: list[dict[str, str]] = []
    value: Any = raw
    if isinstance(raw, str):
        text = raw.strip()
        fenced = re.fullmatch(r"\x60{3}(?:json)?\s*\n?([\s\S]*?)\n?\x60{3}", text)
        if fenced:
            text = fenced.group(1).strip()
            warnings.append({"path": "/", "code": "CODE_FENCE_REMOVED", "message": "Removed JSON code fence."})
        try:
            value = json.loads(text, parse_constant=lambda constant: _invalid_constant(constant))
        except (json.JSONDecodeError, ValueError) as exc:
            raise DomainError("MALFORMED_PROVIDER_JSON", "Provider output is not valid JSON.",
                              details={"reason": str(exc)[:300]}) from exc
    check_json_limits(value)
    expected_keys = set(definition.get("properties", {}))
    if isinstance(value, dict) and definition.get("type") == "object":
        for _ in range(3):
            if not isinstance(value, dict) or len(value) != 1 or expected_keys.intersection(value):
                break
            key = next(iter(value))
            if key not in {"data", "result", "output", "extraction"} or not isinstance(value[key], dict):
                break
            value = value[key]
            warnings.append({
                "path": "/", "code": "WRAPPER_REMOVED",
                "message": f"Unwrapped the '{key}' response object.",
            })

    def coerce(node: Any, schema: dict, path: str) -> Any:
        kind = schema.get("type")
        if isinstance(node, str) and kind in {"number", "integer"}:
            if re.fullmatch(r"-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?", node.strip()):
                number = float(node)
                if math.isfinite(number) and (kind == "number" or number.is_integer()):
                    warnings.append({
                        "path": path or "/", "code": "NUMERIC_STRING",
                        "message": "Converted a numeric string to the schema's numeric type.",
                    })
                    return int(number) if kind == "integer" else number
        if isinstance(node, dict):
            return {
                key: coerce(child, schema.get("properties", {}).get(key, {}), f"{path}/{key}")
                for key, child in node.items()
            }
        if isinstance(node, list):
            item_schema = schema.get("items", {})
            return [coerce(child, item_schema if isinstance(item_schema, dict) else {}, f"{path}/{index}")
                    for index, child in enumerate(node)]
        return node

    return NormalizedOutput(coerce(value, definition, ""), warnings)


def _invalid_constant(value: str):
    raise ValueError(f"Non-finite JSON value: {value}")
