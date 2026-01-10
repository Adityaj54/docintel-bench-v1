from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamped


class ProviderConfiguration(Timestamped, Base):
    __tablename__ = "provider_configurations"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    options: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ExtractionRun(Timestamped, Base):
    __tablename__ = "extraction_runs"

    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id"), index=True)
    dataset_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("datasets.id"), nullable=True
    )
    schema_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("extraction_schemas.id"))
    provider_configuration_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("provider_configurations.id")
    )
    name: Mapped[str] = mapped_column(String(120))
    provider_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    evaluation_options: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    total_documents: Mapped[int] = mapped_column(Integer)
    completed_documents: Mapped[int] = mapped_column(Integer, default=0)
    failed_documents: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))


class ExtractionResult(Timestamped, Base):
    __tablename__ = "extraction_results"
    __table_args__ = (UniqueConstraint("run_id", "document_id"),)

    run_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("extraction_runs.id"), index=True)
    document_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("documents.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    output: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    raw_response: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    normalization_warnings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(16, 8), default=0)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    error: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class ValidationResult(Timestamped, Base):
    __tablename__ = "validation_results"

    result_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("extraction_results.id"), unique=True, index=True
    )
    valid: Mapped[bool] = mapped_column(Boolean)
    errors: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)


class EvaluationResult(Timestamped, Base):
    __tablename__ = "evaluation_results"

    result_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("extraction_results.id"), unique=True, index=True
    )
    ground_truth_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("ground_truths.id"))
    ground_truth_version: Mapped[int] = mapped_column(Integer)
    matched_fields: Mapped[int] = mapped_column(Integer)
    total_fields: Mapped[int] = mapped_column(Integer)
    precision: Mapped[float] = mapped_column(Float)
    recall: Mapped[float] = mapped_column(Float)
    f1: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    differences: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    options: Mapped[dict[str, Any]] = mapped_column(JSON)
