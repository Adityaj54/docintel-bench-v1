from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    *,
    project_id: UUID | None,
    user_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: UUID,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        project_id=project_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
    )
    db.add(entry)
    return entry


def list_events(
    db: Session,
    project_id: UUID,
    *,
    action: str | None = None,
    entity: str | None = None,
    user_id: UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    filters = [AuditLog.project_id == project_id]
    if action:
        filters.append(AuditLog.action == action)
    if entity:
        filters.append(AuditLog.entity_type == entity)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if since:
        filters.append(AuditLog.created_at >= since)
    if until:
        filters.append(AuditLog.created_at <= until)
    total = db.scalar(select(func.count()).select_from(AuditLog).where(*filters)) or 0
    rows = db.scalars(
        select(AuditLog)
        .where(*filters)
        .order_by(AuditLog.created_at.desc(), AuditLog.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return list(rows), total
