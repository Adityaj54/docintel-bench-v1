import time
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.core.time import utcnow
from app.evaluation.compare import evaluate
from app.evaluation.options import EvaluationOptions
from app.jobs.queue import enqueue
from app.models import (
    Document,
    EvaluationResult,
    ExtractionResult,
    ExtractionRun,
    ExtractionSchema,
    GroundTruth,
    ValidationResult,
)
from app.normalization.service import normalize_response
from app.preprocessing.service import preprocess
from app.providers.base import ProviderInput
from app.providers.registry import get_provider
from app.services.runs import RUN_TERMINAL, TERMINAL
from app.storage.factory import get_storage
from app.validation.schema import validate_output
from app.webhooks.service import emit


def finish_run(db: Session, run_id: UUID) -> None:
    db.flush()
    run = db.scalar(select(ExtractionRun).where(ExtractionRun.id == run_id)
                    .execution_options(populate_existing=True).with_for_update())
    if not run or run.status in RUN_TERMINAL:
        return
    results = db.scalars(select(ExtractionResult).where(ExtractionResult.run_id == run.id)).all()
    run.completed_documents = sum(result.status == "completed" for result in results)
    run.failed_documents = sum(result.status == "failed" for result in results)
    if any(result.status not in TERMINAL for result in results):
        run.status = "running"
        return
    if run.failed_documents == run.total_documents:
        run.status = "failed"
    elif run.failed_documents:
        run.status = "partially_failed"
    else:
        run.status = "completed"
    run.finished_at = utcnow()
    event = "run.failed" if run.status == "failed" else "run.completed"
    emit(db, run.project_id, event, str(run.id), {
        "run_id": str(run.id), "name": run.name, "status": run.status,
        "completed_documents": run.completed_documents,
        "failed_documents": run.failed_documents,
    })


def fail_result(db: Session, result: ExtractionResult, error: DomainError) -> None:
    run = db.get(ExtractionRun, result.run_id)
    if not run or run.status == "cancelled" or result.status == "cancelled":
        return
    result.status = "failed"
    result.error = {"code": error.code, "message": error.message, "details": error.details}
    emit(db, run.project_id, "extraction.failed", str(result.id), {
        "run_id": str(run.id), "result_id": str(result.id),
        "document_id": str(result.document_id), "error": result.error,
    })
    finish_run(db, run.id)


def preprocessing_stage(db: Session, identifier: UUID) -> None:
    document = db.get(Document, identifier)
    if not document or document.deleted:
        return
    if document.status != "ready":
        document.status = "processing"
        db.commit()
        artifacts = preprocess(document, get_storage())
        db.refresh(document)
        if document.deleted:
            return
        document.artifacts = artifacts
        document.status = "ready"
        document.error = None
    waiting = db.scalars(select(ExtractionResult).where(
        ExtractionResult.document_id == identifier, ExtractionResult.status == "queued"
    )).all()
    for result in waiting:
        enqueue(db, "extract", result.id)


def extraction_stage(db: Session, identifier: UUID) -> None:
    result = db.get(ExtractionResult, identifier)
    if not result or result.status in TERMINAL or result.status in {"validating", "evaluating"}:
        return
    run = db.get(ExtractionRun, result.run_id)
    if run.status == "cancelled":
        result.status = "cancelled"
        return
    document = db.get(Document, result.document_id)
    if not document or document.deleted:
        raise DomainError("FILE_MISSING", "The document is unavailable.")
    if document.status == "failed":
        raise DomainError("PREPROCESSING_FAILED", "Document preprocessing failed.")
    if document.status != "ready":
        raise DomainError("DOCUMENT_NOT_READY", "Document preprocessing has not completed.")
    schema = db.get(ExtractionSchema, run.schema_id)
    storage = get_storage()
    snapshot = run.provider_snapshot
    result.status = "extracting"
    result.attempts += 1
    run.status = "running"
    run.started_at = run.started_at or utcnow()
    db.commit()
    request = ProviderInput(
        document_hash=document.sha256,
        filename=document.original_filename,
        schema=schema.definition,
        pages=[storage.get(artifact["storage_key"]) for artifact in document.artifacts],
        text="\n".join(artifact.get("text", "") for artifact in document.artifacts),
        model=snapshot["model"],
        options=snapshot["options"],
    )
    started = time.perf_counter()
    output = get_provider(snapshot["provider"]).extract(request)
    elapsed = (time.perf_counter() - started) * 1000
    db.refresh(run)
    db.refresh(result)
    if run.status == "cancelled" or result.status == "cancelled":
        result.status = "cancelled"
        return
    result.raw_response = output.raw
    result.latency_ms = elapsed
    result.input_tokens = output.input_tokens
    result.output_tokens = output.output_tokens
    result.estimated_cost = output.estimated_cost
    try:
        normalized = normalize_response(output.content, schema.definition)
    except DomainError as error:
        fail_result(db, result, error)
        return
    result.output = normalized.value
    result.normalization_warnings = normalized.warnings
    result.status = "validating"
    enqueue(db, "validate", result.id)


def validation_stage(db: Session, identifier: UUID) -> None:
    result = db.get(ExtractionResult, identifier)
    if not result or result.status in TERMINAL:
        return
    run = db.get(ExtractionRun, result.run_id)
    if run.status == "cancelled":
        result.status = "cancelled"
        return
    existing = db.scalar(select(ValidationResult).where(ValidationResult.result_id == result.id))
    if not existing:
        schema = db.get(ExtractionSchema, run.schema_id)
        report = validate_output(result.output, schema.definition)
        db.add(ValidationResult(result_id=result.id, valid=report["valid"], errors=report["errors"]))
    result.status = "evaluating"
    enqueue(db, "evaluate", result.id)


def evaluation_stage(db: Session, identifier: UUID) -> None:
    result = db.get(ExtractionResult, identifier)
    if not result or result.status in {"failed", "cancelled"}:
        return
    run = db.get(ExtractionRun, result.run_id)
    if run.status == "cancelled":
        if result.status != "completed":
            result.status = "cancelled"
        return
    truth = db.scalar(select(GroundTruth).where(
        GroundTruth.document_id == result.document_id, GroundTruth.schema_id == run.schema_id
    ))
    if truth:
        report = evaluate(truth.value, result.output, EvaluationOptions(**run.evaluation_options))
        evaluation = db.scalar(select(EvaluationResult).where(EvaluationResult.result_id == result.id))
        if evaluation is None:
            evaluation = EvaluationResult(
                result_id=result.id, ground_truth_id=truth.id,
                ground_truth_version=truth.version, **report,
            )
            db.add(evaluation)
        else:
            if truth.version >= evaluation.ground_truth_version:
                for key, value in report.items():
                    setattr(evaluation, key, value)
                evaluation.ground_truth_version = truth.version
                evaluation.ground_truth_id = truth.id
    result.status = "completed"
    finish_run(db, run.id)


def terminal_failure(db: Session, kind: str, identifier: UUID, error: DomainError) -> None:
    if kind == "preprocess":
        document = db.get(Document, identifier)
        if document and not document.deleted:
            document.status = "failed"
            document.error = {"code": error.code, "message": error.message}
            results = db.scalars(select(ExtractionResult).where(
                ExtractionResult.document_id == document.id, ExtractionResult.status == "queued"
            )).all()
            for result in results:
                fail_result(db, result, error)
    elif kind in {"extract", "validate", "evaluate"}:
        result = db.get(ExtractionResult, identifier)
        if result and result.status not in TERMINAL:
            fail_result(db, result, error)
    elif kind == "webhook":
        from app.models import WebhookDelivery

        delivery = db.get(WebhookDelivery, identifier)
        if delivery:
            delivery.status = "failed"
            delivery.last_error = error.message
