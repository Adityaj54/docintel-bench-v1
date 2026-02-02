from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from app.auth.dependencies import AuthenticatedUser, Database
from app.api.pagination import Limit, Offset, page
from app.models import ExtractionSchema
from app.schemas.common import Page
from app.schemas.projects import (
    SchemaActivation, SchemaClone, SchemaCreate, SchemaRead, SchemaVersion,
    SampleValidation, SampleValidationRead,
)
from app.services import schemas
from app.services.access import project_for

router = APIRouter(tags=["schemas"])


@router.get("/projects/{project_id}/schemas", response_model=Page[SchemaRead])
def browse(project_id: UUID, db: Database, user: AuthenticatedUser,
           limit: Limit = 100, offset: Offset = 0):
    project_for(db, project_id, user)
    query = select(ExtractionSchema).where(ExtractionSchema.project_id == project_id).order_by(
        ExtractionSchema.name, ExtractionSchema.version.desc()
    )
    return page(db, query, limit, offset)


@router.post("/projects/{project_id}/schemas", response_model=SchemaRead, status_code=201)
def create(project_id: UUID, data: SchemaCreate, db: Database, user: AuthenticatedUser):
    return schemas.create(db, user, project_id, data)


@router.get("/schemas/{schema_id}", response_model=SchemaRead)
def detail(schema_id: UUID, db: Database, user: AuthenticatedUser):
    return schemas.schema_for(db, schema_id, user)


@router.post("/schemas/{schema_id}/versions", response_model=SchemaRead, status_code=201)
def version(schema_id: UUID, data: SchemaVersion, db: Database, user: AuthenticatedUser):
    return schemas.version(db, user, schema_id, data)


@router.post("/schemas/{schema_id}/clone", response_model=SchemaRead, status_code=201)
def clone(schema_id: UUID, data: SchemaClone, db: Database, user: AuthenticatedUser):
    original = schemas.schema_for(db, schema_id, user)
    return schemas.create(db, user, original.project_id, SchemaCreate(
        name=data.name, description=original.description, definition=original.definition,
    ))


@router.put("/schemas/{schema_id}/activation", response_model=SchemaRead)
def activate(schema_id: UUID, data: SchemaActivation, db: Database, user: AuthenticatedUser):
    return schemas.activate(db, user, schema_id, data.active)


@router.post("/schemas/{schema_id}/validate", response_model=SampleValidationRead)
def validate(schema_id: UUID, data: SampleValidation, db: Database, user: AuthenticatedUser):
    return schemas.validate_sample(db, user, schema_id, data.value)
