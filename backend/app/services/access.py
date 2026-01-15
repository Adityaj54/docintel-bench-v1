from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainError
from app.models import Dataset, Document, ExtractionResult, ExtractionRun, Project, User


def project_for(db: Session, identifier: UUID, user: User, writable: bool = False) -> Project:
    project = db.scalar(select(Project).where(Project.id == identifier, Project.owner_id == user.id))
    if not project:
        raise DomainError("NOT_FOUND", "Project not found.", 404)
    if writable and project.archived:
        raise DomainError("PROJECT_ARCHIVED", "Restore the project before making changes.", 409)
    return project


def dataset_for(db: Session, identifier: UUID, user: User, writable: bool = False) -> Dataset:
    dataset = db.get(Dataset, identifier)
    if not dataset:
        raise DomainError("NOT_FOUND", "Dataset not found.", 404)
    project_for(db, dataset.project_id, user, writable)
    return dataset


def document_for(db: Session, identifier: UUID, user: User, writable: bool = False) -> Document:
    document = db.get(Document, identifier)
    if not document or document.deleted:
        raise DomainError("NOT_FOUND", "Document not found.", 404)
    dataset_for(db, document.dataset_id, user, writable)
    return document


def run_for(db: Session, identifier: UUID, user: User) -> ExtractionRun:
    run = db.get(ExtractionRun, identifier)
    if not run:
        raise DomainError("NOT_FOUND", "Extraction run not found.", 404)
    project_for(db, run.project_id, user)
    return run


def result_for(db: Session, identifier: UUID, user: User) -> ExtractionResult:
    result = db.get(ExtractionResult, identifier)
    if not result:
        raise DomainError("NOT_FOUND", "Extraction result not found.", 404)
    run_for(db, result.run_id, user)
    return result
