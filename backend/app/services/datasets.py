from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.models import Dataset, Document, User
from app.schemas.projects import DatasetCreate, DatasetRead
from app.services.access import dataset_for, project_for


def serialize(db: Session, dataset: Dataset) -> dict:
    count = db.scalar(select(func.count()).select_from(Document).where(
        Document.dataset_id == dataset.id, Document.deleted.is_(False)
    )) or 0
    return {**DatasetRead.model_validate(dataset).model_dump(), "document_count": count}


def create(db: Session, user: User, project_id: UUID, data: DatasetCreate) -> Dataset:
    project_for(db, project_id, user, True)
    dataset = Dataset(project_id=project_id, **data.model_dump())
    db.add(dataset)
    db.flush()
    record(db, project_id=project_id, user_id=user.id, action="dataset.created",
           entity_type="dataset", entity_id=dataset.id, details={"name": dataset.name})
    db.commit()
    return dataset


def update(db: Session, user: User, identifier: UUID, data: DatasetCreate) -> Dataset:
    dataset = dataset_for(db, identifier, user, True)
    dataset.name = data.name
    dataset.description = data.description
    record(db, project_id=dataset.project_id, user_id=user.id, action="dataset.updated",
           entity_type="dataset", entity_id=dataset.id, details=data.model_dump())
    db.commit()
    return dataset
