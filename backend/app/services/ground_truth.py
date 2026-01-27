from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.errors import DomainError
from app.jobs.queue import enqueue
from app.models import ExtractionResult, ExtractionRun, GroundTruth, User
from app.schemas.documents import GroundTruthWrite
from app.services.access import dataset_for, document_for, result_for
from app.services.schemas import schema_for
from app.validation.schema import validate_output


def write(
    db: Session,
    user: User,
    document_id: UUID,
    data: GroundTruthWrite,
    source: str | None = None,
) -> GroundTruth:
    document = document_for(db, document_id, user, True)
    dataset = dataset_for(db, document.dataset_id, user)
    schema = schema_for(db, data.schema_id, user)
    if schema.project_id != dataset.project_id:
        raise DomainError("SCHEMA_PROJECT_MISMATCH", "Choose a schema from this document's project.")
    validation = validate_output(data.value, schema.definition)
    if not validation["valid"]:
        raise DomainError("INVALID_GROUND_TRUTH", "Ground truth must satisfy the selected schema.",
                          details=validation)
    truth = db.scalar(select(GroundTruth).where(
        GroundTruth.document_id == document.id, GroundTruth.schema_id == schema.id
    ).with_for_update())
    previous = None
    if truth:
        if data.expected_version != truth.version:
            raise DomainError("REVISION_CONFLICT", "Ground truth changed. Reload before saving.", 409)
        previous = truth.value
        truth.value = data.value
        truth.version += 1
        truth.updated_by = user.id
        truth.source = source or data.source
    else:
        if data.expected_version is not None:
            raise DomainError("REVISION_CONFLICT", "The expected ground truth does not exist.", 409)
        truth = GroundTruth(
            document_id=document.id, schema_id=schema.id,
            value=data.value, updated_by=user.id, source=source or data.source,
        )
        db.add(truth)
    db.flush()
    record(db, project_id=dataset.project_id, user_id=user.id, action="ground_truth.updated",
           entity_type="ground_truth", entity_id=truth.id,
           details={"document_id": str(document.id), "version": truth.version,
                    "before": previous, "after": data.value, "source": truth.source})
    results = db.scalars(select(ExtractionResult).join(ExtractionRun).where(
        ExtractionResult.document_id == document.id,
        ExtractionResult.status == "completed",
        ExtractionRun.schema_id == schema.id,
    )).all()
    for result in results:
        enqueue(db, "evaluate", result.id, f"evaluate:{result.id}:truth:{truth.version}")
    db.commit()
    return truth


def promote(db: Session, user: User, result_id: UUID, expected_version: int | None) -> GroundTruth:
    result = result_for(db, result_id, user)
    if result.status != "completed":
        raise DomainError("RESULT_NOT_READY", "Only completed extractions can become ground truth.", 409)
    run = db.get(ExtractionRun, result.run_id)
    return write(db, user, result.document_id, GroundTruthWrite(
        schema_id=run.schema_id, value=result.output, expected_version=expected_version,
    ), source="promoted")
