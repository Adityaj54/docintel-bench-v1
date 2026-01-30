import logging
from datetime import timedelta
from uuid import UUID

from billiard.exceptions import SoftTimeLimitExceeded
from sqlalchemy import or_, select

from app.core.config import get_settings
from app.core.errors import DomainError, TransientError
from app.core.time import aware, utcnow
from app.db.session import SessionLocal
from app.jobs.stages import (
    evaluation_stage,
    extraction_stage,
    preprocessing_stage,
    terminal_failure,
    validation_stage,
)
from app.models import JobMessage
from app.webhooks.delivery import deliver

HANDLERS = {
    "preprocess": preprocessing_stage,
    "extract": extraction_stage,
    "validate": validation_stage,
    "evaluate": evaluation_stage,
    "webhook": deliver,
}
logger = logging.getLogger("docintel.jobs")


def retry_delay(attempt: int) -> int:
    return min(300, 2 ** min(attempt, 8))


def dispatch() -> int:
    from app.jobs.celery_app import celery

    sent = 0
    with SessionLocal() as db:
        now = utcnow()
        messages = db.scalars(select(JobMessage).where(
            or_(
                (JobMessage.status == "pending") & (JobMessage.available_at <= now),
                (JobMessage.status.in_(["dispatched", "running"])) & (JobMessage.leased_until < now),
            )
        ).order_by(JobMessage.available_at).limit(100).with_for_update(skip_locked=True)).all()
        pending = []
        for message in messages:
            message.status = "dispatched"
            message.leased_until = now + timedelta(seconds=get_settings().job_lease_seconds)
            pending.append((str(message.id), message.kind))
        db.commit()
        for identifier, kind in pending:
            try:
                celery.send_task(f"docintel.{kind}", args=[identifier])
                sent += 1
            except Exception:
                message = db.get(JobMessage, UUID(identifier))
                message.status = "pending"
                message.available_at = utcnow() + timedelta(seconds=5)
                db.commit()
                logger.warning("Broker dispatch failed.", extra={"job_id": identifier})
    return sent


def execute(identifier: str, kind: str) -> None:
    settings = get_settings()
    with SessionLocal() as db:
        message = db.scalar(select(JobMessage).where(JobMessage.id == UUID(identifier)).with_for_update())
        if not message or message.status in {"completed", "failed"}:
            return
        if message.kind != kind:
            raise ValueError("Job kind does not match its task.")
        if message.status == "running" and message.leased_until and aware(message.leased_until) > utcnow():
            return
        message.status = "running"
        message.attempts += 1
        message.leased_until = utcnow() + timedelta(seconds=settings.job_lease_seconds)
        entity_id = message.entity_id
        attempt = message.attempts
        db.commit()
        try:
            HANDLERS[kind](db, entity_id)
            message = db.get(JobMessage, UUID(identifier))
            message.status = "completed"
            message.leased_until = None
            message.error = None
            db.commit()
            logger.info("Job completed.", extra={"job_id": identifier})
        except Exception as exception:
            db.rollback()
            if isinstance(exception, SoftTimeLimitExceeded):
                error = TransientError("Worker stage exceeded its time limit.", "JOB_TIMEOUT")
            elif isinstance(exception, DomainError):
                error = exception
            else:
                error = DomainError("JOB_FAILED", "Background processing failed.")
                logger.error("Unexpected job error: %s", type(exception).__name__,
                             extra={"job_id": identifier})
            message = db.get(JobMessage, UUID(identifier))
            message.error = {"code": error.code, "message": error.message}
            message.leased_until = None
            if isinstance(error, TransientError) and attempt < settings.job_max_attempts:
                message.status = "pending"
                message.available_at = utcnow() + timedelta(seconds=retry_delay(attempt))
            else:
                message.status = "failed"
                terminal_failure(db, kind, entity_id, error)
            db.commit()
