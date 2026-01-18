import json
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker, SchemaError

from app.core.errors import DomainError


def check_json_limits(value: Any, depth: int = 0, budget: list[int] | None = None) -> None:
    budget = budget if budget is not None else [20000]
    budget[0] -= 1
    if depth > 30 or budget[0] < 0:
        raise DomainError("JSON_COMPLEXITY_LIMIT", "JSON is too deeply nested or contains too many values.")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise DomainError("INVALID_JSON", "Object keys must be strings.")
            check_json_limits(child, depth + 1, budget)
    elif isinstance(value, list):
        if len(value) > 200:
            raise DomainError("JSON_ARRAY_LIMIT", "Arrays are limited to 200 items.")
        for child in value:
            check_json_limits(child, depth + 1, budget)


def check_definition(definition: dict[str, Any]) -> None:
    check_json_limits(definition)
    if len(json.dumps(definition)) > 100000:
        raise DomainError("SCHEMA_TOO_LARGE", "Schema must be smaller than 100 KB.")

    def inspect(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in {"$ref", "$dynamicRef", "$recursiveRef"}:
                    if not isinstance(value, str) or not value.startswith("#/"):
                        raise DomainError("EXTERNAL_SCHEMA_REF", "Only local #/ schema references are allowed.")
                if key == "pattern" and isinstance(value, str) and len(value) > 200:
                    raise DomainError("SCHEMA_PATTERN_LIMIT", "Patterns are limited to 200 characters.")
                inspect(value)
        elif isinstance(node, list):
            for child in node:
                inspect(child)

    inspect(definition)
    try:
        Draft202012Validator.check_schema(definition)
    except SchemaError as exc:
        raise DomainError("INVALID_SCHEMA", exc.message, details={"path": list(exc.path)}) from exc


def validate_output(value: Any, definition: dict[str, Any]) -> dict[str, Any]:
    check_json_limits(value)
    validator = Draft202012Validator(definition, format_checker=FormatChecker())
    try:
        errors = sorted(validator.iter_errors(value), key=lambda error: str(list(error.path)))
        issues = [
            {
                "path": "/" + "/".join(str(part).replace("~", "~0").replace("/", "~1")
                                      for part in error.absolute_path),
                "validator": error.validator,
                "expected": error.validator_value,
                "received": error.instance,
                "received_type": type(error.instance).__name__,
                "message": error.message,
            }
            for error in errors[:100]
        ]
    except (RecursionError, ValueError) as exc:
        raise DomainError("SCHEMA_EVALUATION_FAILED", "Schema could not be evaluated safely.") from exc
    return {"valid": not errors, "errors": issues, "error_count": len(errors)}
