from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.config import get_settings
from app.core.errors import DomainError
from app.jobs.queue import enqueue
from app.models import Document, ExtractionResult, User
from app.preprocessing.inspect import inspect_file
from app.schemas.documents import DocumentRead
from app.services.access import dataset_for, document_for
from app.storage.factory import get_storage


def serialize(document: Document) -> dict:
    data = {
        key: getattr(document, key)
        for key in DocumentRead.model_fields
        if key != "artifacts"
    }
    data["artifacts"] = [
        {
            "page": artifact["page"],
            "width": artifact["width"],
            "height": artifact["height"],
            "mime_type": artifact["mime_type"],
            "url": f"/api/documents/{document.id}/pages/{artifact['page']}",
        }
        for artifact in document.artifacts
    ]
    return data


async def upload(db: Session, user: User, dataset_id: UUID, file: UploadFile) -> Document:
    dataset = dataset_for(db, dataset_id, user, True)
    content = bytearray()
    maximum = get_settings().max_upload_bytes
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > maximum:
            raise DomainError("FILE_TOO_LARGE", "The document exceeds the upload size limit.", 413)
    inspected = inspect_file(file.filename or "", file.content_type or "", bytes(content))
    existing = db.scalar(select(Document).where(
        Document.dataset_id == dataset.id, Document.sha256 == inspected.sha256
    ))
    if existing and not existing.deleted:
        raise DomainError("DUPLICATE_DOCUMENT", "This document already exists in the dataset.", 409)
    identifier = existing.id if existing else uuid4()
    key = f"documents/{dataset.project_id}/{identifier}/original-{uuid4()}"
    storage = get_storage()
    storage.put(key, bytes(content), inspected.mime_type)
    if existing:
        return _restore(db, user, dataset, existing, inspected, key, storage)
    document = Document(
        id=identifier,
        dataset_id=dataset.id,
        original_filename=inspected.filename,
        mime_type=inspected.mime_type,
        size_bytes=inspected.size_bytes,
        sha256=inspected.sha256,
        storage_key=key,
        page_count=inspected.page_count,
        width=inspected.width,
        height=inspected.height,
        uploaded_by=user.id,
    )
    try:
        db.add(document)
        db.flush()
        enqueue(db, "preprocess", identifier)
        record(db, project_id=dataset.project_id, user_id=user.id, action="document.uploaded",
               entity_type="document", entity_id=identifier,
               details={"filename": inspected.filename, "sha256": inspected.sha256})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        storage.delete(key)
        raise DomainError("DUPLICATE_DOCUMENT", "This document already exists in the dataset.", 409) from exc
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    return document


def _restore(db: Session, user: User, dataset, document: Document, inspected,
             key: str, storage) -> Document:
    """Re-upload of content matching a deleted document revives that row.

    The (dataset_id, sha256) uniqueness constraint means a soft-deleted document
    would otherwise reserve its content hash forever, rejecting the re-upload as a
    duplicate of a document the account can no longer see.
    """
    previous_key = document.storage_key
    document.original_filename = inspected.filename
    document.mime_type = inspected.mime_type
    document.size_bytes = inspected.size_bytes
    document.storage_key = key
    document.page_count = inspected.page_count
    document.width = inspected.width
    document.height = inspected.height
    document.status = "queued"
    document.artifacts = []
    document.error = None
    document.deleted = False
    document.uploaded_by = user.id
    try:
        db.flush()
        enqueue(db, "preprocess", document.id, f"preprocess:{document.id}:{uuid4()}")
        record(db, project_id=dataset.project_id, user_id=user.id, action="document.restored",
               entity_type="document", entity_id=document.id,
               details={"filename": inspected.filename, "sha256": inspected.sha256})
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    if previous_key and previous_key != key:
        storage.delete(previous_key)
    return document


def delete(db: Session, user: User, identifier: UUID) -> None:
    document = document_for(db, identifier, user, True)
    active = db.scalar(select(ExtractionResult.id).where(
        ExtractionResult.document_id == document.id,
        ExtractionResult.status.not_in(["completed", "failed", "cancelled"]),
    ))
    if active:
        raise DomainError("DOCUMENT_IN_USE", "Cancel active extraction runs before deleting this document.", 409)
    dataset = dataset_for(db, document.dataset_id, user)
    document.deleted = True
    document.status = "deleted"
    record(db, project_id=dataset.project_id, user_id=user.id, action="document.deleted",
           entity_type="document", entity_id=document.id,
           details={"filename": document.original_filename})
    db.commit()
    storage = get_storage()
    storage.delete(document.storage_key)
    for artifact in document.artifacts:
        storage.delete(artifact["storage_key"])


def retry_preprocessing(db: Session, user: User, identifier: UUID) -> Document:
    document = document_for(db, identifier, user, True)
    if document.status != "failed":
        raise DomainError("INVALID_DOCUMENT_STATE", "Only failed documents can be retried.", 409)
    document.status = "queued"
    document.error = None
    enqueue(db, "preprocess", document.id, f"preprocess:{document.id}:{uuid4()}")
    db.commit()
    return document
