from collections import Counter, defaultdict
from datetime import datetime
from statistics import mean
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Dataset, Document, EvaluationResult, ExtractionResult, ExtractionRun, ValidationResult,
)
from app.schemas.operations import MetricReport, MetricSummary, ProviderMetric


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def average(values: list[float]) -> float | None:
    return mean(values) if values else None


def result_rows(db: Session, project_id: UUID, run_ids: list[UUID] | None = None,
                since: datetime | None = None, until: datetime | None = None):
    query = select(
        ExtractionResult.status, ExtractionResult.provider, ExtractionResult.model,
        ExtractionResult.latency_ms, ExtractionResult.estimated_cost,
        ExtractionResult.created_at, ExtractionResult.error, ValidationResult.valid,
        EvaluationResult.score,
    ).join(ExtractionRun).outerjoin(
        ValidationResult, ValidationResult.result_id == ExtractionResult.id
    ).outerjoin(EvaluationResult, EvaluationResult.result_id == ExtractionResult.id).where(
        ExtractionRun.project_id == project_id
    )
    if run_ids is not None:
        query = query.where(ExtractionRun.id.in_(run_ids))
    if since:
        query = query.where(ExtractionResult.created_at >= since)
    if until:
        query = query.where(ExtractionResult.created_at <= until)
    return db.execute(query).all()


def provider_metric(rows, provider: str, model: str) -> ProviderMetric:
    count = len(rows)
    latency = [row.latency_ms for row in rows if row.latency_ms is not None]
    validity = [float(row.valid) for row in rows if row.valid is not None]
    scores = [row.score for row in rows if row.score is not None]
    cost = sum(float(row.estimated_cost or 0) for row in rows)
    return ProviderMetric(
        provider=provider,
        model=model,
        total=count,
        success_rate=sum(row.status == "completed" for row in rows) / count if count else 0,
        validity_rate=average(validity),
        average_score=average(scores),
        average_latency_ms=average(latency),
        p50_latency_ms=percentile(latency, .5),
        p95_latency_ms=percentile(latency, .95),
        total_cost=cost,
        cost_per_document=cost / count if count else 0,
        failures=sum(row.status == "failed" for row in rows),
    )


def report(db: Session, project_id: UUID, since: datetime | None = None,
           until: datetime | None = None) -> MetricReport:
    rows = result_rows(db, project_id, since=since, until=until)
    combined = provider_metric(rows, "all", "all")
    run_query = select(ExtractionRun.status, func.count()).where(
        ExtractionRun.project_id == project_id
    )
    if since:
        run_query = run_query.where(ExtractionRun.created_at >= since)
    if until:
        run_query = run_query.where(ExtractionRun.created_at <= until)
    runs = dict(db.execute(run_query.group_by(ExtractionRun.status)).all())
    documents = db.scalar(select(func.count()).select_from(Document).join(Dataset).where(
        Dataset.project_id == project_id, Document.deleted.is_(False)
    )) or 0
    mime = db.execute(select(Document.mime_type, func.count()).join(Dataset).where(
        Dataset.project_id == project_id, Document.deleted.is_(False)
    ).group_by(Document.mime_type)).all()
    groups = defaultdict(list)
    volume = defaultdict(Counter)
    errors = Counter()
    for row in rows:
        groups[(row.provider, row.model)].append(row)
        day = row.created_at.date().isoformat()
        volume[day]["total"] += 1
        volume[day][row.status] += 1
        if row.error:
            errors[row.error.get("code", "UNKNOWN")] += 1
    summary = MetricSummary(
        document_count=documents,
        extraction_count=len(rows),
        successful_runs=runs.get("completed", 0),
        failed_runs=runs.get("failed", 0) + runs.get("partially_failed", 0),
        success_rate=combined.success_rate if rows else None,
        validation_success_rate=combined.validity_rate,
        average_evaluation_score=combined.average_score,
        average_latency_ms=combined.average_latency_ms,
        p50_latency_ms=combined.p50_latency_ms,
        p95_latency_ms=combined.p95_latency_ms,
        estimated_total_cost=combined.total_cost,
        cost_per_document=combined.cost_per_document,
        failure_count=combined.failures,
    )
    return MetricReport(
        summary=summary,
        volume=[{"date": day, "total": counts["total"], "completed": counts["completed"],
                 "failed": counts["failed"]} for day, counts in sorted(volume.items())],
        mime_types=[{"label": label, "count": count} for label, count in mime],
        errors=[{"label": label, "count": count} for label, count in errors.most_common()],
        providers=[provider_metric(group, *key) for key, group in sorted(groups.items())],
    )
