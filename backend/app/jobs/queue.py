from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utcnow
from app.models import JobMessage


def enqueue(
    db: Session,
    kind: str,
    entity_id: UUID,
    dedupe_key: str | None = None,
    delay: int = 0,
) -> JobMessage:
    key = dedupe_key or f"{kind}:{entity_id}"
    existing = db.scalar(select(JobMessage).where(JobMessage.dedupe_key == key))
    if existing:
        return existing
    message = JobMessage(
        kind=kind,
        entity_id=entity_id,
        dedupe_key=key,
        available_at=utcnow() + timedelta(seconds=delay),
    )
    db.add(message)
    return message
