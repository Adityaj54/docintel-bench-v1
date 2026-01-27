from uuid import UUID

from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.errors import DomainError
from app.models import ProviderConfiguration, User
from app.providers.registry import provider_availability
from app.schemas.runs import ProviderCreate, ProviderRead
from app.services.access import project_for


def serialize(configuration: ProviderConfiguration) -> dict:
    return {
        **ProviderRead.model_validate(configuration).model_dump(),
        "available": provider_availability().get(configuration.provider, False),
    }


def create(db: Session, user: User, project_id: UUID, data: ProviderCreate) -> ProviderConfiguration:
    project_for(db, project_id, user, True)
    configuration = ProviderConfiguration(project_id=project_id, **data.model_dump())
    db.add(configuration)
    db.flush()
    record(db, project_id=project_id, user_id=user.id, action="provider.created",
           entity_type="provider", entity_id=configuration.id,
           details={"provider": data.provider, "model": data.model})
    db.commit()
    return configuration


def update(db: Session, user: User, identifier: UUID, data: ProviderCreate) -> ProviderConfiguration:
    configuration = db.get(ProviderConfiguration, identifier)
    if not configuration:
        raise DomainError("NOT_FOUND", "Provider configuration not found.", 404)
    project_for(db, configuration.project_id, user, True)
    for key, value in data.model_dump().items():
        setattr(configuration, key, value)
    record(db, project_id=configuration.project_id, user_id=user.id, action="provider.updated",
           entity_type="provider", entity_id=configuration.id,
           details={"provider": data.provider, "model": data.model, "active": data.active})
    db.commit()
    return configuration
