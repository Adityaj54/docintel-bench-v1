from app.evaluation.compare import evaluate
from app.evaluation.options import EvaluationOptions


def statuses(result):
    return {row["path"]: row["status"] for row in result["differences"]}


def test_identical_documents_score_perfectly():
    document = {"invoice_number": "INV-1", "total": 10.0}
    result = evaluate(document, document)
    assert result["score"] == 1.0
    assert result["f1"] == 1.0
    assert set(statuses(result).values()) == {"match"}


def test_a_changed_scalar_is_reported_with_both_values():
    result = evaluate({"total": 10.0}, {"total": 12.0})
    row = next(row for row in result["differences"] if row["path"] == "/total")
    assert row["status"] == "changed"
    assert row["expected"] == 10.0
    assert row["actual"] == 12.0


def test_a_missing_field_is_distinguished_from_an_extra_one():
    result = evaluate({"a": 1, "b": 2}, {"a": 1, "c": 3})
    assert statuses(result) == {"/a": "match", "/b": "missing", "/c": "extra"}


def test_a_type_change_is_reported_as_a_type_mismatch():
    result = evaluate({"total": 10}, {"total": "10"})
    assert statuses(result)["/total"] == "type_mismatch"


def test_string_comparison_ignores_case_by_default():
    assert evaluate({"currency": "EUR"}, {"currency": "eur"})["score"] == 1.0


def test_case_sensitivity_can_be_required():
    options = EvaluationOptions(case_sensitive=True)
    assert evaluate({"currency": "EUR"}, {"currency": "eur"}, options)["score"] == 0.0


def test_whitespace_and_unicode_are_normalised_by_default():
    assert evaluate({"name": "Acme  Ltd"}, {"name": "Acme Ltd"})["score"] == 1.0


def test_normalisation_can_be_disabled():
    options = EvaluationOptions(normalize_strings=False, case_sensitive=True)
    assert evaluate({"name": "Acme  Ltd"}, {"name": "Acme Ltd"}, options)["score"] == 0.0


def test_numbers_within_the_absolute_tolerance_match():
    options = EvaluationOptions(numeric_tolerance=0.01)
    assert evaluate({"total": 10.00}, {"total": 10.005}, options)["score"] == 1.0


def test_numbers_outside_the_absolute_tolerance_do_not_match():
    options = EvaluationOptions(numeric_tolerance=0.01)
    assert evaluate({"total": 10.00}, {"total": 10.5}, options)["score"] == 0.0


def test_relative_tolerance_scales_with_magnitude():
    options = EvaluationOptions(numeric_tolerance=0, relative_tolerance=0.01)
    assert evaluate({"total": 10000.0}, {"total": 10050.0}, options)["score"] == 1.0
    assert evaluate({"total": 10000.0}, {"total": 10500.0}, options)["score"] == 0.0


def test_booleans_are_not_treated_as_numbers():
    assert evaluate({"paid": True}, {"paid": 1})["differences"][0]["status"] == "type_mismatch"


def test_ordered_arrays_compare_element_by_element():
    result = evaluate({"items": [1, 2, 3]}, {"items": [1, 9, 3]})
    assert statuses(result)["/items/1"] == "changed"


def test_reordered_arrays_fail_when_order_matters():
    result = evaluate({"items": ["a", "b"]}, {"items": ["b", "a"]})
    assert result["score"] == 0.0


def test_unordered_arrays_match_regardless_of_position():
    options = EvaluationOptions(array_order="unordered")
    result = evaluate({"items": ["a", "b"]}, {"items": ["b", "a"]}, options)
    assert result["score"] == 1.0


def test_unordered_objects_pair_by_best_fit():
    expected = {"lines": [
        {"description": "Widget", "amount": 10.0},
        {"description": "Gadget", "amount": 20.0},
    ]}
    actual = {"lines": [
        {"description": "Gadget", "amount": 20.0},
        {"description": "Widget", "amount": 10.0},
    ]}
    options = EvaluationOptions(array_order="unordered")
    assert evaluate(expected, actual, options)["score"] == 1.0


def test_a_shorter_array_reports_the_absent_elements():
    result = evaluate({"items": [1, 2, 3]}, {"items": [1]})
    assert statuses(result)["/items/1"] == "missing"
    assert statuses(result)["/items/2"] == "missing"


def test_nested_objects_are_compared_by_path():
    expected = {"supplier": {"name": "Acme", "address": {"city": "Berlin", "postcode": "10115"}}}
    actual = {"supplier": {"name": "Acme", "address": {"city": "Munich", "postcode": "10115"}}}
    result = evaluate(expected, actual)
    assert statuses(result)["/supplier/address/city"] == "changed"
    assert statuses(result)["/supplier/address/postcode"] == "match"


def test_extra_fields_can_be_excluded_from_scoring():
    expected = {"a": 1}
    actual = {"a": 1, "b": 2}
    assert evaluate(expected, actual)["score"] < 1.0
    options = EvaluationOptions(ignore_extra_fields=True)
    assert evaluate(expected, actual, options)["score"] == 1.0


def test_precision_and_recall_separate_the_two_kinds_of_error():
    result = evaluate({"a": 1, "b": 2}, {"a": 1, "c": 3})
    assert result["precision"] == 0.5
    assert result["recall"] == 0.5
    assert result["f1"] == 0.5


def test_missing_fields_lower_recall_more_than_precision():
    result = evaluate({"a": 1, "b": 2, "c": 3}, {"a": 1})
    assert result["precision"] == 1.0
    assert result["recall"] < 1.0


def test_json_pointer_escaping_is_applied_to_awkward_keys():
    result = evaluate({"a/b": 1}, {"a/b": 2})
    assert result["differences"][0]["path"] == "/a~1b"


def test_the_options_used_are_reported_back():
    options = EvaluationOptions(array_order="unordered", numeric_tolerance=0.5)
    result = evaluate({"a": 1}, {"a": 1}, options)
    assert result["options"]["array_order"] == "unordered"
    assert result["options"]["numeric_tolerance"] == 0.5
