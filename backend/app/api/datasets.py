from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from app.api.pagination import Limit, Offset, page
from app.auth.dependencies import AuthenticatedUser, Database
from app.models import Dataset
from app.schemas.common import Page
from app.schemas.projects import DatasetCreate, DatasetRead
from app.services import datasets
from app.services.access import dataset_for, project_for

router = APIRouter(tags=["datasets"])


@router.get("/projects/{project_id}/datasets", response_model=Page[DatasetRead])
def browse(project_id: UUID, db: Database, user: AuthenticatedUser,
           limit: Limit = 100, offset: Offset = 0):
    project_for(db, project_id, user)
    query = select(Dataset).where(Dataset.project_id == project_id).order_by(
        Dataset.created_at.desc(), Dataset.id
    )
    return page(db, query, limit, offset, lambda row: datasets.serialize(db, row))


@router.post("/projects/{project_id}/datasets", response_model=DatasetRead, status_code=201)
def create(project_id: UUID, data: DatasetCreate, db: Database, user: AuthenticatedUser):
    return datasets.serialize(db, datasets.create(db, user, project_id, data))


@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def detail(dataset_id: UUID, db: Database, user: AuthenticatedUser):
    return datasets.serialize(db, dataset_for(db, dataset_id, user))


@router.put("/datasets/{dataset_id}", response_model=DatasetRead)
def update(dataset_id: UUID, data: DatasetCreate, db: Database, user: AuthenticatedUser):
    return datasets.serialize(db, datasets.update(db, user, dataset_id, data))
