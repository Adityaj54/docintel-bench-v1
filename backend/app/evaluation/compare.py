import math
import unicodedata
from typing import Any

from app.evaluation.assignment import minimum_assignment
from app.evaluation.options import EvaluationOptions
from app.validation.schema import check_json_limits

MISSING = object()


def pointer(path: str, key: str | int) -> str:
    escaped = str(key).replace("~", "~0").replace("/", "~1")
    return f"{path}/{escaped}"


def kind(value: Any) -> str:
    if value is MISSING:
        return "missing"
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (float, int)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def normalized_string(value: str, options: EvaluationOptions) -> str:
    if options.normalize_strings:
        value = " ".join(unicodedata.normalize("NFKC", value).split())
    return value if options.case_sensitive else value.casefold()


def scalar_matches(expected: Any, actual: Any, options: EvaluationOptions) -> bool:
    if kind(expected) != kind(actual):
        return False
    if isinstance(expected, bool) or expected is None:
        return expected == actual
    if isinstance(expected, (float, int)):
        return math.isclose(
            expected, actual,
            abs_tol=options.numeric_tolerance,
            rel_tol=options.relative_tolerance,
        )
    if isinstance(expected, str):
        return normalized_string(expected, options) == normalized_string(actual, options)
    return expected == actual


def difference(path: str, expected: Any, actual: Any, status: str, actual_path: str) -> dict:
    return {
        "path": path or "/",
        "actual_path": actual_path or "/",
        "status": status,
        "expected_present": expected is not MISSING,
        "actual_present": actual is not MISSING,
        "expected": None if expected is MISSING else expected,
        "actual": None if actual is MISSING else actual,
        "expected_type": kind(expected),
        "actual_type": kind(actual),
    }


def compare_nodes(
    expected: Any,
    actual: Any,
    options: EvaluationOptions,
    path: str = "",
    actual_path: str = "",
) -> list[dict]:
    if expected is MISSING or actual is MISSING:
        value = actual if expected is MISSING else expected
        status = "extra" if expected is MISSING else "missing"
        if isinstance(value, dict) and value:
            return [
                row
                for key, child in value.items()
                for row in compare_nodes(
                    MISSING if expected is MISSING else child,
                    child if expected is MISSING else MISSING,
                    options, pointer(path, key), pointer(actual_path, key),
                )
            ]
        if isinstance(value, list) and value:
            return [
                row
                for index, child in enumerate(value)
                for row in compare_nodes(
                    MISSING if expected is MISSING else child,
                    child if expected is MISSING else MISSING,
                    options, pointer(path, index), pointer(actual_path, index),
                )
            ]
        return [difference(path, expected, actual, status, actual_path)]
    if kind(expected) != kind(actual):
        return [difference(path, expected, actual, "type_mismatch", actual_path)]
    if isinstance(expected, dict):
        keys = sorted(set(expected) | set(actual))
        if not keys:
            return [difference(path, expected, actual, "match", actual_path)]
        return [
            row
            for key in keys
            for row in compare_nodes(
                expected.get(key, MISSING), actual.get(key, MISSING),
                options, pointer(path, key), pointer(actual_path, key),
            )
        ]
    if isinstance(expected, list):
        if not expected and not actual:
            return [difference(path, expected, actual, "match", actual_path)]
        if options.array_order == "unordered" and expected and actual:
            return unordered_rows(expected, actual, options, path, actual_path)
        return [
            row
            for index in range(max(len(expected), len(actual)))
            for row in compare_nodes(
                expected[index] if index < len(expected) else MISSING,
                actual[index] if index < len(actual) else MISSING,
                options, pointer(path, index), pointer(actual_path, index),
            )
        ]
    status = "match" if scalar_matches(expected, actual, options) else "changed"
    return [difference(path, expected, actual, status, actual_path)]


def unordered_rows(
    expected: list,
    actual: list,
    options: EvaluationOptions,
    path: str,
    actual_path: str,
) -> list[dict]:
    size = max(len(expected), len(actual))
    costs = [[1.0] * size for _ in range(size)]
    for left_index, left in enumerate(expected):
        for right_index, right in enumerate(actual):
            rows = compare_nodes(left, right, options)
            costs[left_index][right_index] = (
                sum(row["status"] != "match" for row in rows) / max(1, len(rows))
            )
    assignment = minimum_assignment(costs)
    output = []
    used = set()
    for index, expected_value in enumerate(expected):
        selected = assignment[index]
        has_actual = selected < len(actual)
        if has_actual:
            used.add(selected)
        output.extend(compare_nodes(
            expected_value,
            actual[selected] if has_actual else MISSING,
            options,
            pointer(path, index),
            pointer(actual_path, selected if has_actual else index),
        ))
    for index, actual_value in enumerate(actual):
        if index not in used:
            output.extend(compare_nodes(
                MISSING, actual_value, options,
                pointer(path, index), pointer(actual_path, index),
            ))
    return output


def evaluate(expected: Any, actual: Any, options: EvaluationOptions | None = None) -> dict:
    options = options or EvaluationOptions()
    check_json_limits(expected)
    check_json_limits(actual)
    rows = compare_nodes(expected, actual, options)
    scored = [
        row for row in rows
        if not (options.ignore_extra_fields and row["status"] == "extra")
    ]
    matched = sum(row["status"] == "match" for row in scored)
    predicted = sum(row["status"] != "missing" for row in scored)
    trusted = sum(row["status"] != "extra" for row in scored)
    precision = matched / predicted if predicted else (1.0 if not trusted else 0.0)
    recall = matched / trusted if trusted else (1.0 if not predicted else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "matched_fields": matched,
        "total_fields": len(scored),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "score": matched / len(scored) if scored else 1.0,
        "differences": rows,
        "options": options.model_dump(),
    }
