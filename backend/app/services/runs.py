from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.time import utcnow
from app.jobs.queue import enqueue
from app.models import (
    Dataset,
    Document,
    EvaluationResult,
    ExtractionResult,
    ExtractionRun,
    ExtractionSchema,
    ProviderConfiguration,
    User,
    ValidationResult,
)
from app.providers.registry import provider_availability
from app.schemas.runs import ResultRead, RunCreate
from app.services.access import project_for, run_for

TERMINAL = {"completed", "failed", "cancelled"}
RUN_TERMINAL = {"completed", "partially_failed", "failed", "cancelled"}


def create(db: Session, user: User, project_id: UUID, data: RunCreate) -> ExtractionRun:
    project_for(db, project_id, user, True)
    schema = db.get(ExtractionSchema, data.schema_id)
    configuration = db.get(ProviderConfiguration, data.provider_configuration_id)
    if not schema or schema.project_id != project_id or not schema.active:
        raise DomainError("INVALID_SCHEMA_SELECTION", "Choose an active schema from this project.")
    if not configuration or configuration.project_id != project_id or not configuration.active:
        raise DomainError("INVALID_PROVIDER_SELECTION", "Choose an active provider from this project.")
    if not provider_availability().get(configuration.provider):
        raise DomainError("PROVIDER_NOT_CONFIGURED", "The selected provider has no environment credentials.")
    query = select(Document).join(Dataset).where(
        Dataset.project_id == project_id, Document.deleted.is_(False)
    )
    if data.dataset_id:
        dataset = db.get(Dataset, data.dataset_id)
        if not dataset or dataset.project_id != project_id:
            raise DomainError("NOT_FOUND", "Dataset not found.", 404)
        query = query.where(Document.dataset_id == dataset.id)
    else:
        query = query.where(Document.id.in_(data.document_ids))
    documents = list(db.scalars(query).all())
    if data.document_ids and len(documents) != len(data.document_ids):
        raise DomainError("INVALID_DOCUMENT_SELECTION", "Some selected documents are unavailable.")
    if not documents:
        raise DomainError("EMPTY_DATASET", "Upload documents before starting a run.")
    if len(documents) > get_settings().max_run_documents:
        raise DomainError("RUN_DOCUMENT_LIMIT", "This selection exceeds the per-run document limit.")
    run = ExtractionRun(
        project_id=project_id,
        dataset_id=data.dataset_id,
        schema_id=schema.id,
        provider_configuration_id=configuration.id,
        name=data.name,
        provider_snapshot={
            "name": configuration.name,
            "provider": configuration.provider,
            "model": configuration.model,
            "options": configuration.options,
        },
        evaluation_options=data.evaluation_options.model_dump(),
        total_documents=len(documents),
        created_by=user.id,
    )
    db.add(run)
    db.flush()
    for document in documents:
        result = ExtractionResult(
            run_id=run.id, document_id=document.id,
            provider=configuration.provider, model=configuration.model,
        )
        db.add(result)
        db.flush()
        if document.status in {"ready", "failed"}:
            enqueue(db, "extract", result.id)
        else:
            enqueue(db, "preprocess", document.id)
    record(db, project_id=project_id, user_id=user.id, action="run.started",
           entity_type="run", entity_id=run.id,
           details={"document_count": len(documents), "schema_id": str(schema.id),
                    "provider": configuration.provider, "model": configuration.model})
    db.commit()
    return run


def cancel(db: Session, user: User, identifier: UUID) -> ExtractionRun:
    run_for(db, identifier, user)
    run = db.scalar(select(ExtractionRun).where(ExtractionRun.id == identifier).with_for_update())
    if run.status in RUN_TERMINAL:
        raise DomainError("RUN_FINISHED", "This run has already finished.", 409)
    run.status = "cancelled"
    run.finished_at = utcnow()
    results = db.scalars(select(ExtractionResult).where(ExtractionResult.run_id == run.id)).all()
    for result in results:
        if result.status not in TERMINAL:
            result.status = "cancelled"
    record(db, project_id=run.project_id, user_id=user.id, action="run.cancelled",
           entity_type="run", entity_id=run.id)
    db.commit()
    return run


def serialize_result(db: Session, result: ExtractionResult, include_raw: bool = True) -> dict:
    data = {
        key: getattr(result, key)
        for key in ResultRead.model_fields
        if key not in {"document_name", "validation", "evaluation"}
    }
    document = db.get(Document, result.document_id)
    data["document_name"] = document.original_filename if document else "Deleted document"
    data["validation"] = db.scalar(select(ValidationResult).where(ValidationResult.result_id == result.id))
    data["evaluation"] = db.scalar(select(EvaluationResult).where(EvaluationResult.result_id == result.id))
    if not include_raw:
        data["raw_response"] = None
    return data
