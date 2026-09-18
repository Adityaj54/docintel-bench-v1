from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import EntityRead, InputModel, UpdatedRead


class AuditRead(EntityRead):
    project_id: UUID | None
    user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID
    details: dict[str, Any]


class WebhookWrite(InputModel):
    name: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1, max_length=2000)
    events: list[Literal["run.completed", "run.failed", "extraction.failed"]] = Field(
        min_length=1, max_length=3
    )
    active: bool = True


class WebhookRead(UpdatedRead):
    project_id: UUID
    name: str
    url: str
    events: list[str]
    active: bool


class DeliveryRead(UpdatedRead):
    webhook_id: UUID
    event: str
    status: str
    attempts: int
    last_status_code: int | None
    last_error: str | None
    attempt_history: list[dict[str, Any]]


class MetricSummary(InputModel):
    document_count: int
    extraction_count: int
    successful_runs: int
    failed_runs: int
    success_rate: float | None
    validation_success_rate: float | None
    average_evaluation_score: float | None
    average_latency_ms: float | None
    p50_latency_ms: float | None
    p95_latency_ms: float | None
    estimated_total_cost: float
    cost_per_document: float
    failure_count: int


class MetricBucket(InputModel):
    label: str
    count: int


class VolumePoint(InputModel):
    date: str
    total: int
    completed: int
    failed: int


class ProviderMetric(InputModel):
    provider: str
    model: str
    total: int
    success_rate: float
    validity_rate: float | None
    average_score: float | None
    average_latency_ms: float | None
    p50_latency_ms: float | None
    p95_latency_ms: float | None
    total_cost: float
    cost_per_document: float
    failures: int


class MetricReport(InputModel):
    summary: MetricSummary
    volume: list[VolumePoint]
    mime_types: list[MetricBucket]
    errors: list[MetricBucket]
    providers: list[ProviderMetric]


class RunComparison(InputModel):
    run_id: UUID
    name: str
    status: str
    metrics: ProviderMetric


class MetricSignificance(InputModel):
    metric: str
    label: str
    direction: Literal["higher", "lower"]
    pairs: int
    baseline_mean: float
    candidate_mean: float
    difference: float
    confidence: float
    confidence_low: float
    confidence_high: float
    p_value: float
    adjusted_p_value: float
    exact: bool
    minimum_detectable_effect: float | None
    verdict: Literal["better", "worse", "inconclusive"]


class RunSignificance(InputModel):
    run_id: UUID
    name: str
    baseline_run_id: UUID
    baseline_name: str
    paired_documents: int
    metrics: list[MetricSignificance]


class SettingsRead(InputModel):
    providers: dict[str, bool]
    storage_backend: str
    max_upload_bytes: int
    max_pdf_pages: int
    max_run_documents: int
    webhook_enabled: bool
    webhook_allowed_hosts: list[str]


class HealthRead(InputModel):
    status: str
    database: bool | None = None
    redis: bool | None = None
    checked_at: datetime
