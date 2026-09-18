import pytest

from app.evaluation.significance import (
    bootstrap_interval,
    compare_paired,
    corrected_fraction,
    holm_adjusted,
    jackknife_acceleration,
    minimum_detectable_effect,
    paired_differences,
    permutation_p_value,
    quantile,
)
from tests.conftest import drain, png_bytes, upload


def spread(values):
    return {index: value for index, value in enumerate(values)}


def test_only_documents_both_runs_measured_are_paired():
    assert paired_differences({"a": 1.0, "b": 2.0}, {"b": 2.5, "c": 9.0}) == [0.5]


def test_pairing_follows_a_stable_order():
    baseline = {"b": 1.0, "a": 1.0}
    candidate = {"a": 2.0, "b": 5.0}
    assert paired_differences(baseline, candidate) == [1.0, 4.0]


def test_quantile_interpolates_between_neighbours():
    assert quantile([0.0, 1.0, 2.0, 3.0], 0.5) == 1.5
    assert quantile([], 0.5) is None


class TestBootstrapInterval:
    def test_a_consistent_improvement_produces_an_interval_above_zero(self):
        low, high = bootstrap_interval([0.08, 0.11, 0.09, 0.12, 0.1, 0.09, 0.11, 0.1])
        assert low > 0
        assert low < 0.1 < high

    def test_noise_produces_an_interval_that_contains_zero(self):
        low, high = bootstrap_interval([0.4, -0.5, 0.2, -0.3, 0.1, -0.2, 0.3, -0.4])
        assert low < 0 < high

    def test_the_same_sample_always_gives_the_same_interval(self):
        sample = [0.1, -0.05, 0.2, 0.03, 0.08, -0.01, 0.12, 0.04]
        assert bootstrap_interval(sample) == bootstrap_interval(sample)

    def test_a_constant_difference_has_no_width(self):
        assert bootstrap_interval([0.25] * 6) == (0.25, 0.25)

    def test_a_wider_confidence_level_gives_a_wider_interval(self):
        sample = [0.1, -0.05, 0.2, 0.03, 0.08, -0.01, 0.12, 0.04]
        narrow = bootstrap_interval(sample, confidence=0.8)
        wide = bootstrap_interval(sample, confidence=0.99)
        assert wide[0] <= narrow[0] and wide[1] >= narrow[1]


class TestCorrectedFraction:
    def test_no_bias_and_no_skew_leaves_the_percentile_alone(self):
        assert corrected_fraction(0.975, bias=0.0, acceleration=0.0) == pytest.approx(0.975)

    def test_a_biased_sample_moves_the_percentile(self):
        assert corrected_fraction(0.975, bias=0.2, acceleration=0.0) > 0.975

    def test_an_extreme_acceleration_falls_back_to_the_plain_percentile(self):
        assert corrected_fraction(0.975, bias=0.0, acceleration=10.0) == 0.975


class TestJackknifeAcceleration:
    def test_a_symmetric_sample_needs_no_correction(self):
        assert jackknife_acceleration([-2.0, -1.0, 1.0, 2.0]) == pytest.approx(0, abs=1e-12)

    def test_a_skewed_sample_is_corrected(self):
        assert jackknife_acceleration([0.0, 0.1, 0.2, 9.0]) != 0

    def test_a_sample_without_spread_is_left_alone(self):
        assert jackknife_acceleration([3.0, 3.0, 3.0]) == 0.0
        assert jackknife_acceleration([1.0]) == 0.0


class TestPermutationTest:
    def test_small_samples_are_enumerated_exactly(self):
        p_value, exact = permutation_p_value([0.2] * 8)
        assert exact is True
        assert p_value == pytest.approx(2 / 2 ** 8)

    def test_large_samples_fall_back_to_sampling(self):
        p_value, exact = permutation_p_value([0.2] * 20, resamples=200)
        assert exact is False
        assert p_value == pytest.approx(1 / 201)

    def test_a_run_that_changed_nothing_is_never_significant(self):
        assert permutation_p_value([0.0] * 6) == (1.0, True)

    def test_noise_does_not_look_like_a_difference(self):
        p_value, _ = permutation_p_value([0.3, -0.25, 0.1, -0.2, 0.05, -0.1])
        assert p_value > 0.05

    def test_the_direction_of_the_difference_does_not_change_the_evidence(self):
        forward, _ = permutation_p_value([0.1, 0.2, 0.15, 0.05, 0.12, 0.09])
        backward, _ = permutation_p_value([-0.1, -0.2, -0.15, -0.05, -0.12, -0.09])
        assert forward == backward


class TestMinimumDetectableEffect:
    def test_a_single_pair_cannot_detect_anything(self):
        assert minimum_detectable_effect([0.5]) is None

    def test_a_noisier_sample_needs_a_larger_effect(self):
        quiet = minimum_detectable_effect([0.1, 0.11, 0.09, 0.1, 0.12, 0.08])
        noisy = minimum_detectable_effect([0.1, 0.9, -0.4, 0.6, -0.8, 0.3])
        assert noisy > quiet

    def test_more_documents_detect_a_smaller_effect(self):
        sample = [0.2, -0.1, 0.3, -0.2, 0.1, 0.0]
        assert minimum_detectable_effect(sample * 4) < minimum_detectable_effect(sample)


class TestHolmAdjustment:
    def test_the_smallest_p_value_carries_the_largest_penalty(self):
        assert holm_adjusted([0.01, 0.04, 0.2]) == pytest.approx([0.03, 0.08, 0.2])

    def test_adjusted_values_never_exceed_one(self):
        assert holm_adjusted([0.6, 0.7, 0.8]) == [1.0, 1.0, 1.0]

    def test_a_single_test_needs_no_adjustment(self):
        assert holm_adjusted([0.02]) == [0.02]

    def test_the_adjustment_never_reorders_the_evidence(self):
        adjusted = holm_adjusted([0.2, 0.001, 0.05, 0.03])
        assert adjusted[1] <= adjusted[3] <= adjusted[2] <= adjusted[0]

    def test_nothing_to_adjust(self):
        assert holm_adjusted([]) == []


class TestComparePaired:
    def test_a_clear_improvement_is_reported_with_its_interval(self):
        result = compare_paired(spread([0.70] * 8), spread([0.80] * 8))
        assert result.pairs == 8
        assert result.baseline_mean == pytest.approx(0.70)
        assert result.candidate_mean == pytest.approx(0.80)
        assert result.difference == pytest.approx(0.10)
        assert result.p_value < 0.05
        assert result.exact is True

    def test_averages_ignore_documents_the_other_run_never_saw(self):
        baseline = {"a": 0.5, "b": 0.5, "orphan": 0.0}
        candidate = {"a": 0.6, "b": 0.6, "stranger": 1.0}
        result = compare_paired(baseline, candidate)
        assert result.pairs == 2
        assert result.baseline_mean == pytest.approx(0.5)
        assert result.candidate_mean == pytest.approx(0.6)

    def test_one_shared_document_is_not_enough_to_compare(self):
        assert compare_paired({"a": 1.0}, {"a": 2.0, "b": 3.0}) is None

    def test_nothing_in_common_is_not_a_comparison(self):
        assert compare_paired({"a": 1.0}, {"b": 2.0}) is None


def documents(client, dataset, count):
    for index in range(count):
        response = upload(client, dataset["id"], f"invoice-{index}.png",
                          png_bytes(colour=(index * 7 + 1, 30, 40)), "image/png")
        assert response.status_code == 201, response.text
    drain()


def run_over(client, project, dataset, schema_version, provider_id, name):
    response = client.post(f"/projects/{project['id']}/runs", json={
        "name": name, "dataset_id": dataset["id"], "schema_id": schema_version["id"],
        "provider_configuration_id": provider_id,
    })
    assert response.status_code == 201, response.text
    drain()
    return response.json()


def failing_provider(client, project):
    response = client.post(f"/projects/{project['id']}/providers", json={
        "name": "Mock outage", "provider": "mock", "model": "mock-extract-1",
        "options": {"max_tokens": 4096, "input_cost_per_million": 1.0,
                    "output_cost_per_million": 2.0, "failure_every": 1},
    })
    assert response.status_code == 201, response.text
    return response.json()


def significance(client, project, run_ids):
    query = "&".join(f"run_ids={identifier}" for identifier in run_ids)
    return client.get(f"/projects/{project['id']}/comparison/significance?{query}")


class TestSignificanceEndpoint:
    def test_two_identical_runs_show_no_detectable_difference(self, client, project, dataset,
                                                              schema_version, provider):
        documents(client, dataset, 3)
        baseline = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        repeat = run_over(client, project, dataset, schema_version, provider["id"], "Repeat")

        body = significance(client, project, [baseline["id"], repeat["id"]]).json()

        assert len(body) == 1
        assert body[0]["baseline_name"] == "Baseline"
        assert body[0]["name"] == "Repeat"
        assert body[0]["paired_documents"] == 3
        assert {metric["verdict"] for metric in body[0]["metrics"]} == {"inconclusive"}

    def test_every_metric_carries_its_interval_and_adjusted_evidence(self, client, project,
                                                                     dataset, schema_version,
                                                                     provider):
        documents(client, dataset, 3)
        baseline = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        repeat = run_over(client, project, dataset, schema_version, provider["id"], "Repeat")

        metrics = significance(client, project, [baseline["id"], repeat["id"]]).json()[0]["metrics"]

        assert {metric["metric"] for metric in metrics} >= {"success_rate", "cost_per_document"}
        for metric in metrics:
            assert metric["confidence"] == 0.95
            assert metric["confidence_low"] <= metric["difference"] <= metric["confidence_high"]
            assert metric["adjusted_p_value"] >= metric["p_value"]
            assert metric["pairs"] == 3
            assert metric["direction"] in {"higher", "lower"}

    def test_a_run_that_fails_every_document_is_called_worse(self, client, project, dataset,
                                                             schema_version, provider):
        documents(client, dataset, 8)
        baseline = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        broken = run_over(client, project, dataset, schema_version,
                          failing_provider(client, project)["id"], "Outage")

        metrics = significance(client, project, [baseline["id"], broken["id"]]).json()[0]["metrics"]
        completion = next(metric for metric in metrics if metric["metric"] == "success_rate")

        assert completion["difference"] == pytest.approx(-1.0)
        assert completion["confidence_high"] < 0
        assert completion["adjusted_p_value"] < 0.05
        assert completion["verdict"] == "worse"

    def test_the_comparison_is_reproducible(self, client, project, dataset, schema_version,
                                            provider):
        documents(client, dataset, 4)
        baseline = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        repeat = run_over(client, project, dataset, schema_version, provider["id"], "Repeat")

        first = significance(client, project, [baseline["id"], repeat["id"]]).json()
        second = significance(client, project, [baseline["id"], repeat["id"]]).json()
        assert first == second

    def test_each_candidate_is_tested_against_the_first_run(self, client, project, dataset,
                                                            schema_version, provider):
        documents(client, dataset, 2)
        baseline = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        second = run_over(client, project, dataset, schema_version, provider["id"], "Second")
        third = run_over(client, project, dataset, schema_version, provider["id"], "Third")

        body = significance(client, project, [baseline["id"], second["id"], third["id"]]).json()

        assert [entry["name"] for entry in body] == ["Second", "Third"]
        assert {entry["baseline_run_id"] for entry in body} == {baseline["id"]}

    def test_one_run_compared_with_itself_is_refused(self, client, project, dataset,
                                                     schema_version, provider):
        documents(client, dataset, 2)
        run = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")

        response = significance(client, project, [run["id"], run["id"]])
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_COMPARISON"

    def test_a_run_from_another_project_is_not_found(self, client, project, dataset,
                                                     schema_version, provider):
        documents(client, dataset, 2)
        run = run_over(client, project, dataset, schema_version, provider["id"], "Baseline")
        other = client.post("/projects", json={"name": "Receipts", "description": ""}).json()

        response = significance(client, other, [run["id"], run["id"]])
        assert response.status_code == 404

    def test_a_comparison_needs_two_runs(self, client, project):
        response = client.get(f"/projects/{project['id']}/comparison/significance")
        assert response.status_code == 422
