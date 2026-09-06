import pytest

from app.core.errors import DomainError
from app.normalization.service import normalize_response

INVOICE = {
    "type": "object",
    "properties": {
        "invoice_number": {"type": "string"},
        "total": {"type": "number"},
        "quantity": {"type": "integer"},
        "line_items": {
            "type": "array",
            "items": {"type": "object", "properties": {"amount": {"type": "number"}}},
        },
    },
}


def codes(result):
    return {warning["code"] for warning in result.warnings}


def test_plain_json_object_passes_through():
    result = normalize_response('{"invoice_number": "INV-1", "total": 12.5}', INVOICE)
    assert result.value == {"invoice_number": "INV-1", "total": 12.5}
    assert result.warnings == []


def test_a_markdown_code_fence_is_stripped():
    result = normalize_response('```json\n{"invoice_number": "INV-2"}\n```', INVOICE)
    assert result.value == {"invoice_number": "INV-2"}
    assert "CODE_FENCE_REMOVED" in codes(result)


def test_a_bare_fence_without_a_language_is_stripped():
    result = normalize_response('```\n{"invoice_number": "INV-3"}\n```', INVOICE)
    assert result.value == {"invoice_number": "INV-3"}


def test_a_wrapper_object_is_unwrapped():
    result = normalize_response('{"data": {"invoice_number": "INV-4"}}', INVOICE)
    assert result.value == {"invoice_number": "INV-4"}
    assert "WRAPPER_REMOVED" in codes(result)


def test_nested_wrappers_are_unwrapped():
    result = normalize_response('{"result": {"output": {"invoice_number": "INV-5"}}}', INVOICE)
    assert result.value == {"invoice_number": "INV-5"}


def test_a_wrapper_key_that_is_a_real_field_is_kept():
    schema = {"type": "object", "properties": {"data": {"type": "string"}}}
    result = normalize_response('{"data": "not a wrapper"}', schema)
    assert result.value == {"data": "not a wrapper"}


def test_numeric_strings_are_coerced_to_the_schema_type():
    result = normalize_response('{"total": "12.50", "quantity": "3"}', INVOICE)
    assert result.value == {"total": 12.5, "quantity": 3}
    assert "NUMERIC_STRING" in codes(result)


def test_numeric_coercion_reaches_into_arrays():
    result = normalize_response('{"line_items": [{"amount": "4.25"}]}', INVOICE)
    assert result.value == {"line_items": [{"amount": 4.25}]}


def test_a_non_numeric_string_is_left_alone():
    result = normalize_response('{"total": "twelve"}', INVOICE)
    assert result.value == {"total": "twelve"}
    assert "NUMERIC_STRING" not in codes(result)


def test_a_fractional_string_is_not_forced_into_an_integer():
    result = normalize_response('{"quantity": "3.5"}', INVOICE)
    assert result.value == {"quantity": "3.5"}


def test_null_values_are_preserved():
    result = normalize_response('{"invoice_number": null}', INVOICE)
    assert result.value == {"invoice_number": None}


def test_malformed_json_raises_rather_than_returning_nothing():
    with pytest.raises(DomainError) as failure:
        normalize_response('{"invoice_number": "INV-6"', INVOICE)
    assert failure.value.code == "MALFORMED_PROVIDER_JSON"
    assert failure.value.details["reason"]


def test_non_finite_numbers_are_rejected():
    with pytest.raises(DomainError) as failure:
        normalize_response('{"total": NaN}', INVOICE)
    assert failure.value.code == "MALFORMED_PROVIDER_JSON"


def test_already_parsed_payloads_are_accepted():
    result = normalize_response({"invoice_number": "INV-7"}, INVOICE)
    assert result.value == {"invoice_number": "INV-7"}


def test_deeply_nested_payloads_are_refused():
    depth = 200
    payload = "[" * depth + "1" + "]" * depth
    with pytest.raises(DomainError) as failure:
        normalize_response(payload, INVOICE)
    assert failure.value.code in {"JSON_COMPLEXITY_LIMIT", "MALFORMED_PROVIDER_JSON"}
