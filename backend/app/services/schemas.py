from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.errors import DomainError
from app.models import ExtractionSchema, Project, User
from app.schemas.projects import SchemaCreate, SchemaVersion
from app.services.access import project_for
from app.validation.schema import check_definition, validate_output


def schema_for(db: Session, identifier: UUID, user: User, writable: bool = False) -> ExtractionSchema:
    schema = db.get(ExtractionSchema, identifier)
    if not schema:
        raise DomainError("NOT_FOUND", "Schema not found.", 404)
    project_for(db, schema.project_id, user, writable)
    return schema


def create(db: Session, user: User, project_id: UUID, data: SchemaCreate) -> ExtractionSchema:
    project_for(db, project_id, user, True)
    check_definition(data.definition)
    if db.scalar(select(ExtractionSchema.id).where(
        ExtractionSchema.project_id == project_id, ExtractionSchema.name == data.name
    )):
        raise DomainError("SCHEMA_NAME_EXISTS", "Use a new name or create a version.", 409)
    schema = ExtractionSchema(project_id=project_id, created_by=user.id, **data.model_dump())
    db.add(schema)
    db.flush()
    record(db, project_id=project_id, user_id=user.id, action="schema.created",
           entity_type="schema", entity_id=schema.id, details={"name": schema.name, "version": 1})
    db.commit()
    return schema


def version(db: Session, user: User, identifier: UUID, data: SchemaVersion) -> ExtractionSchema:
    previous = schema_for(db, identifier, user, True)
    check_definition(data.definition)
    db.execute(select(Project).where(Project.id == previous.project_id).with_for_update())
    latest = db.scalar(select(func.max(ExtractionSchema.version)).where(
        ExtractionSchema.project_id == previous.project_id, ExtractionSchema.name == previous.name
    )) or 0
    schema = ExtractionSchema(
        project_id=previous.project_id, name=previous.name, version=latest + 1,
        definition=data.definition, description=data.description, created_by=user.id,
    )
    db.add(schema)
    db.flush()
    record(db, project_id=previous.project_id, user_id=user.id, action="schema.versioned",
           entity_type="schema", entity_id=schema.id,
           details={"previous_id": str(previous.id), "version": schema.version})
    db.commit()
    return schema


def activate(db: Session, user: User, identifier: UUID, active: bool) -> ExtractionSchema:
    schema = schema_for(db, identifier, user, True)
    schema.active = active
    record(db, project_id=schema.project_id, user_id=user.id, action="schema.activation_changed",
           entity_type="schema", entity_id=schema.id, details={"active": active})
    db.commit()
    return schema


def validate_sample(db: Session, user: User, identifier: UUID, value):
    schema = schema_for(db, identifier, user)
    return validate_output(value, schema.definition)
