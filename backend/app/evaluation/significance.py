"""Paired significance testing for run comparisons.

Two runs over the same dataset produce one result per document each, so every
metric can be compared document by document rather than run against run.
Pairing removes the variance that comes from documents differing in difficulty,
which is usually far larger than the difference between two providers, and it
is what makes a claim like "this configuration scores four points higher"
worth anything.

Everything here is deterministic: the resampling uses a fixed seed, so the same
two runs always produce the same interval and the same p-value.
"""

from dataclasses import dataclass
from itertools import product
from math import sqrt
from random import Random
from statistics import NormalDist, fmean, stdev

CONFIDENCE = 0.95
SIGNIFICANCE = 0.05
POWER = 0.8
RESAMPLES = 2000
EXACT_LIMIT = 14
SEED = 20260318

_NORMAL = NormalDist()


def quantile(ordered: list[float], fraction: float) -> float | None:
    """Interpolate the value at a fraction of an already sorted sample."""
    if not ordered:
        return None
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def paired_differences(baseline: dict, candidate: dict) -> list[float]:
    """Differences for the keys both runs measured, in a stable order."""
    shared = sorted(set(baseline) & set(candidate), key=str)
    return [candidate[key] - baseline[key] for key in shared]


def jackknife_acceleration(values: list[float]) -> float:
    """Skewness correction for the bootstrap interval, from leave-one-out means."""
    count = len(values)
    if count < 2:
        return 0.0
    total = sum(values)
    leave_one_out = [(total - value) / (count - 1) for value in values]
    centre = fmean(leave_one_out)
    deviations = [centre - value for value in leave_one_out]
    squared = sum(deviation ** 2 for deviation in deviations)
    if squared == 0:
        return 0.0
    return sum(deviation ** 3 for deviation in deviations) / (6 * squared ** 1.5)


def corrected_fraction(fraction: float, bias: float, acceleration: float) -> float:
    """Move a percentile to account for bootstrap bias and skewness."""
    deviate = bias + _NORMAL.inv_cdf(fraction)
    denominator = 1 - acceleration * deviate
    if denominator <= 0:
        return fraction
    return _NORMAL.cdf(bias + deviate / denominator)


def bootstrap_interval(differences: list[float], confidence: float = CONFIDENCE,
                       resamples: int = RESAMPLES, seed: int = SEED) -> tuple[float, float]:
    """Bias-corrected and accelerated interval for the mean paired difference.

    Falls back to the plain percentile interval when the correction is undefined,
    which happens when every resample lands on the same mean.
    """
    count = len(differences)
    observed = fmean(differences)
    random = Random(seed)
    means = sorted(fmean(random.choices(differences, k=count)) for _ in range(resamples))
    low = (1 - confidence) / 2
    high = 1 - low
    below = sum(1 for value in means if value < observed)
    if 0 < below < resamples:
        bias = _NORMAL.inv_cdf(below / resamples)
        acceleration = jackknife_acceleration(differences)
        low = corrected_fraction(low, bias, acceleration)
        high = corrected_fraction(high, bias, acceleration)
    return quantile(means, low), quantile(means, high)


def permutation_p_value(differences: list[float], resamples: int = RESAMPLES,
                        seed: int = SEED) -> tuple[float, bool]:
    """Two-sided paired sign-flip test; the flag says whether it was exhaustive.

    Under the null hypothesis the two runs are interchangeable for each document,
    so every difference may equally well have carried the opposite sign. Small
    samples enumerate all sign patterns; larger ones sample them, with the
    conservative (hits + 1) / (resamples + 1) estimate.
    """
    count = len(differences)
    observed = abs(fmean(differences))
    tolerance = 1e-12
    if count <= EXACT_LIMIT:
        patterns = product((1, -1), repeat=count)
        hits = sum(
            abs(fmean([sign * value for sign, value in zip(pattern, differences)]))
            >= observed - tolerance
            for pattern in patterns
        )
        return hits / 2 ** count, True
    random = Random(seed)
    hits = sum(
        abs(fmean([value if random.random() < 0.5 else -value for value in differences]))
        >= observed - tolerance
        for _ in range(resamples)
    )
    return (hits + 1) / (resamples + 1), False


def minimum_detectable_effect(differences: list[float], significance: float = SIGNIFICANCE,
                              power: float = POWER) -> float | None:
    """Smallest mean difference this many paired documents could have detected."""
    count = len(differences)
    if count < 2:
        return None
    spread = stdev(differences)
    deviates = _NORMAL.inv_cdf(1 - significance / 2) + _NORMAL.inv_cdf(power)
    return deviates * spread / sqrt(count)


def holm_adjusted(p_values: list[float]) -> list[float]:
    """Holm-Bonferroni step-down adjustment, so comparing metrics stays honest."""
    count = len(p_values)
    order = sorted(range(count), key=lambda index: p_values[index])
    adjusted = [0.0] * count
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, min(1.0, (count - rank) * p_values[index]))
        adjusted[index] = running
    return adjusted


@dataclass(frozen=True)
class Significance:
    """One metric compared between a baseline run and a candidate run."""

    pairs: int
    baseline_mean: float
    candidate_mean: float
    difference: float
    confidence_low: float
    confidence_high: float
    p_value: float
    exact: bool
    minimum_detectable_effect: float | None


def compare_paired(baseline: dict, candidate: dict, confidence: float = CONFIDENCE,
                   resamples: int = RESAMPLES, seed: int = SEED) -> Significance | None:
    """Compare one metric across the documents both runs processed."""
    differences = paired_differences(baseline, candidate)
    if len(differences) < 2:
        return None
    shared = sorted(set(baseline) & set(candidate), key=str)
    low, high = bootstrap_interval(differences, confidence, resamples, seed)
    p_value, exact = permutation_p_value(differences, resamples, seed)
    return Significance(
        pairs=len(differences),
        baseline_mean=fmean([baseline[key] for key in shared]),
        candidate_mean=fmean([candidate[key] for key in shared]),
        difference=fmean(differences),
        confidence_low=low,
        confidence_high=high,
        p_value=p_value,
        exact=exact,
        minimum_detectable_effect=minimum_detectable_effect(differences),
    )
