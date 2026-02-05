from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from app.api.pagination import Limit, Offset, page
from app.audit.service import list_events
from app.auth.dependencies import AuthenticatedUser, Database
from app.core.config import get_settings
from app.core.errors import DomainError
from app.models import WebhookConfiguration, WebhookDelivery
from app.providers.registry import provider_availability
from app.schemas.common import Page
from app.schemas.operations import AuditRead, DeliveryRead, SettingsRead, WebhookRead, WebhookWrite
from app.services.access import project_for
from app.webhooks.service import configure

router = APIRouter(tags=["operations"])


@router.get("/settings", response_model=SettingsRead)
def settings(user: AuthenticatedUser):
    config = get_settings()
    return SettingsRead(
        providers=provider_availability(), storage_backend=config.storage_backend,
        max_upload_bytes=config.max_upload_bytes, max_pdf_pages=config.max_pdf_pages,
        max_run_documents=config.max_run_documents,
        webhook_enabled=bool(config.webhook_signing_key),
        webhook_allowed_hosts=sorted(config.webhook_hosts),
    )


@router.get("/projects/{project_id}/audit", response_model=Page[AuditRead])
def audit(project_id: UUID, db: Database, user: AuthenticatedUser,
          action: str | None = None, entity: str | None = None, user_id: UUID | None = None,
          since: datetime | None = None, until: datetime | None = None,
          limit: Limit = 50, offset: Offset = 0):
    project_for(db, project_id, user)
    if since and until and since > until:
        raise DomainError("INVALID_DATE_RANGE", "Start date must precede end date.")
    items, total = list_events(db, project_id, action=action, entity=entity, user_id=user_id,
                               since=since, until=until, limit=limit, offset=offset)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/projects/{project_id}/webhooks", response_model=Page[WebhookRead])
def hooks(project_id: UUID, db: Database, user: AuthenticatedUser,
          limit: Limit = 100, offset: Offset = 0):
    project_for(db, project_id, user)
    return page(db, select(WebhookConfiguration).where(
        WebhookConfiguration.project_id == project_id
    ).order_by(WebhookConfiguration.created_at.desc()), limit, offset)


@router.post("/projects/{project_id}/webhooks", response_model=WebhookRead, status_code=201)
def hook_create(project_id: UUID, data: WebhookWrite, db: Database, user: AuthenticatedUser):
    return configure(db, user, project_id, data)


@router.put("/projects/{project_id}/webhooks/{hook_id}", response_model=WebhookRead)
def hook_update(project_id: UUID, hook_id: UUID, data: WebhookWrite,
                db: Database, user: AuthenticatedUser):
    return configure(db, user, project_id, data, hook_id)


@router.get("/projects/{project_id}/webhooks/{hook_id}/deliveries", response_model=Page[DeliveryRead])
def deliveries(project_id: UUID, hook_id: UUID, db: Database, user: AuthenticatedUser,
               limit: Limit = 50, offset: Offset = 0):
    project_for(db, project_id, user)
    hook = db.get(WebhookConfiguration, hook_id)
    if not hook or hook.project_id != project_id:
        raise DomainError("NOT_FOUND", "Webhook not found.", 404)
    return page(db, select(WebhookDelivery).where(WebhookDelivery.webhook_id == hook_id)
                .order_by(WebhookDelivery.created_at.desc()), limit, offset)
