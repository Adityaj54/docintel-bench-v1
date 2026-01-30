from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.config import get_settings
from app.core.errors import DomainError
from app.jobs.queue import enqueue
from app.models import User, WebhookConfiguration, WebhookDelivery
from app.schemas.operations import WebhookWrite
from app.services.access import project_for
from app.webhooks.security import checked_url


def configure(
    db: Session,
    user: User,
    project_id: UUID,
    data: WebhookWrite,
    identifier: UUID | None = None,
) -> WebhookConfiguration:
    project_for(db, project_id, user, True)
    if not get_settings().webhook_signing_key:
        raise DomainError("WEBHOOK_NOT_CONFIGURED", "Set WEBHOOK_SIGNING_KEY before enabling webhooks.")
    checked_url(data.url)
    if identifier:
        webhook = db.get(WebhookConfiguration, identifier)
        if not webhook or webhook.project_id != project_id:
            raise DomainError("NOT_FOUND", "Webhook not found.", 404)
        for key, value in data.model_dump().items():
            setattr(webhook, key, value)
    else:
        webhook = WebhookConfiguration(project_id=project_id, **data.model_dump())
        db.add(webhook)
    db.flush()
    record(db, project_id=project_id, user_id=user.id, action="webhook.configured",
           entity_type="webhook", entity_id=webhook.id,
           details={"name": webhook.name, "events": webhook.events, "active": webhook.active})
    db.commit()
    return webhook


def emit(db: Session, project_id: UUID, event: str, entity_key: str, data: dict) -> None:
    hooks = db.scalars(select(WebhookConfiguration).where(
        WebhookConfiguration.project_id == project_id,
        WebhookConfiguration.active.is_(True),
    )).all()
    for hook in hooks:
        if event not in hook.events:
            continue
        event_key = f"{hook.id}:{event}:{entity_key}"
        if db.scalar(select(WebhookDelivery.id).where(WebhookDelivery.event_key == event_key)):
            continue
        delivery = WebhookDelivery(
            webhook_id=hook.id,
            event_key=event_key,
            event=event,
            payload={"event": event, "project_id": str(project_id), "data": data},
        )
        db.add(delivery)
        db.flush()
        enqueue(db, "webhook", delivery.id)
