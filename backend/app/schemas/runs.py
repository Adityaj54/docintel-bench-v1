from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.evaluation.options import EvaluationOptions
from app.schemas.common import InputModel, UpdatedRead
from app.schemas.projects import ValidationIssue


class ProviderOptions(InputModel):
    max_tokens: int = Field(default=4096, ge=256, le=16000)
    input_cost_per_million: float = Field(default=0, ge=0, le=1000)
    output_cost_per_million: float = Field(default=0, ge=0, le=10000)
    variant: Literal["baseline", "noisy"] = "baseline"
    failure_every: int = Field(default=0, ge=0, le=20)
    response_format: Literal["plain", "fenced", "wrapped", "malformed"] = "plain"


class ProviderCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    provider: Literal["mock", "openai", "anthropic"]
    model: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9._:/-]+$")
    options: ProviderOptions = Field(default_factory=ProviderOptions)
    active: bool = True


class ProviderRead(UpdatedRead):
    project_id: UUID
    name: str
    provider: str
    model: str
    options: ProviderOptions
    active: bool
    available: bool = True


class RunCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    dataset_id: UUID | None = None
    document_ids: list[UUID] | None = Field(default=None, min_length=1, max_length=1000)
    schema_id: UUID
    provider_configuration_id: UUID
    evaluation_options: EvaluationOptions = Field(default_factory=EvaluationOptions)

    @model_validator(mode="after")
    def selection(self):
        if bool(self.dataset_id) == bool(self.document_ids):
            raise ValueError("Select exactly one dataset or a list of documents.")
        if self.document_ids and len(set(self.document_ids)) != len(self.document_ids):
            raise ValueError("Document selection contains duplicates.")
        return self


class RunRead(UpdatedRead):
    project_id: UUID
    dataset_id: UUID | None
    schema_id: UUID
    provider_configuration_id: UUID
    name: str
    provider_snapshot: dict[str, Any]
    evaluation_options: EvaluationOptions
    status: str
    total_documents: int
    completed_documents: int
    failed_documents: int
    started_at: datetime | None
    finished_at: datetime | None
    created_by: UUID


class NormalizationWarning(InputModel):
    path: str
    code: str
    message: str


class ValidationRead(UpdatedRead):
    result_id: UUID
    valid: bool
    errors: list[ValidationIssue]


class DifferenceRead(InputModel):
    path: str
    actual_path: str
    status: Literal["match", "changed", "missing", "extra", "type_mismatch"]
    expected_present: bool
    actual_present: bool
    expected: Any
    actual: Any
    expected_type: str
    actual_type: str


class EvaluationRead(UpdatedRead):
    result_id: UUID
    ground_truth_id: UUID
    ground_truth_version: int
    matched_fields: int
    total_fields: int
    precision: float
    recall: float
    f1: float
    score: float
    differences: list[DifferenceRead]
    options: EvaluationOptions


class ResultRead(UpdatedRead):
    run_id: UUID
    document_id: UUID
    document_name: str = ""
    status: str
    output: Any = None
    raw_response: dict[str, Any] | None
    normalization_warnings: list[NormalizationWarning]
    latency_ms: float | None
    input_tokens: int
    output_tokens: int
    estimated_cost: float
    provider: str
    model: str
    error: dict[str, Any] | None
    attempts: int
    validation: ValidationRead | None = None
    evaluation: EvaluationRead | None = None
