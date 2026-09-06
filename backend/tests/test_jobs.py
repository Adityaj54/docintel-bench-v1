from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import DomainError, TransientError
from app.core.time import aware, utcnow
from app.db.session import SessionLocal
from app.jobs import runner
from app.jobs.queue import enqueue
from app.jobs.runner import execute, retry_delay
from app.models import JobMessage


@pytest.fixture
def message(db):
    """The queued message's id, as the worker receives it: a string."""
    entity = uuid4()
    job = enqueue(db, "preprocess", entity)
    db.commit()
    return str(job.id)


def reload(identifier: str) -> JobMessage:
    with SessionLocal() as session:
        return session.get(JobMessage, UUID(identifier))


def test_enqueue_is_idempotent_for_the_same_entity(db):
    entity = uuid4()
    first = enqueue(db, "preprocess", entity)
    db.commit()
    second = enqueue(db, "preprocess", entity)
    db.commit()
    assert first.id == second.id
    assert db.scalar(select(JobMessage).where(JobMessage.entity_id == entity)) is not None


def test_a_distinct_dedupe_key_creates_a_separate_message(db):
    entity = uuid4()
    first = enqueue(db, "preprocess", entity)
    db.commit()
    second = enqueue(db, "preprocess", entity, f"preprocess:{entity}:{uuid4()}")
    db.commit()
    assert first.id != second.id


def test_a_delay_pushes_the_message_into_the_future(db):
    job = enqueue(db, "preprocess", uuid4(), delay=60)
    db.commit()
    assert job.available_at > utcnow()


def test_a_successful_handler_completes_the_message(monkeypatch, message):
    monkeypatch.setitem(runner.HANDLERS, "preprocess", lambda db, entity: None)
    execute(message, "preprocess")

    stored = reload(message)
    assert stored.status == "completed"
    assert stored.attempts == 1
    assert stored.error is None
    assert stored.leased_until is None


def test_a_transient_failure_is_retried_with_backoff(monkeypatch, message):
    def flaky(db, entity):
        raise TransientError("Provider rate limited the request.", "RATE_LIMITED")

    monkeypatch.setitem(runner.HANDLERS, "preprocess", flaky)
    execute(message, "preprocess")

    stored = reload(message)
    assert stored.status == "pending"
    assert stored.attempts == 1
    assert stored.error["code"] == "RATE_LIMITED"
    assert aware(stored.available_at) > utcnow()


def test_a_permanent_failure_is_not_retried(monkeypatch, message):
    def broken(db, entity):
        raise DomainError("INVALID_SCHEMA", "The schema cannot be used.")

    monkeypatch.setitem(runner.HANDLERS, "preprocess", broken)
    execute(message, "preprocess")

    stored = reload(message)
    assert stored.status == "failed"
    assert stored.error["code"] == "INVALID_SCHEMA"


def test_an_unexpected_error_does_not_leak_its_message(monkeypatch, message):
    def broken(db, entity):
        raise RuntimeError("connection string postgres://user:secret@host/db")

    monkeypatch.setitem(runner.HANDLERS, "preprocess", broken)
    execute(message, "preprocess")

    stored = reload(message)
    assert stored.status == "failed"
    assert stored.error["code"] == "JOB_FAILED"
    assert "secret" not in stored.error["message"]


def test_transient_failures_stop_at_the_attempt_ceiling(monkeypatch, message):
    def flaky(db, entity):
        raise TransientError("Still unavailable.", "RATE_LIMITED")

    monkeypatch.setitem(runner.HANDLERS, "preprocess", flaky)
    ceiling = get_settings().job_max_attempts
    for _ in range(ceiling):
        with SessionLocal() as session:
            job = session.get(JobMessage, UUID(message))
            job.available_at = utcnow() - timedelta(seconds=1)
            session.commit()
        execute(message, "preprocess")

    stored = reload(message)
    assert stored.attempts == ceiling
    assert stored.status == "failed"


def test_a_completed_message_is_never_run_twice(monkeypatch, message):
    calls = []
    monkeypatch.setitem(runner.HANDLERS, "preprocess", lambda db, entity: calls.append(entity))

    execute(message, "preprocess")
    execute(message, "preprocess")

    assert len(calls) == 1


def test_a_task_refuses_a_message_of_another_kind(monkeypatch, message):
    monkeypatch.setitem(runner.HANDLERS, "extract", lambda db, entity: None)
    with pytest.raises(ValueError):
        execute(message, "extract")


def test_an_unknown_message_id_is_ignored():
    execute(str(uuid4()), "preprocess")


def test_a_held_lease_prevents_concurrent_execution(monkeypatch, message):
    calls = []
    monkeypatch.setitem(runner.HANDLERS, "preprocess", lambda db, entity: calls.append(entity))

    with SessionLocal() as session:
        job = session.get(JobMessage, UUID(message))
        job.status = "running"
        job.leased_until = utcnow() + timedelta(seconds=300)
        session.commit()

    execute(message, "preprocess")
    assert calls == []


def test_an_expired_lease_allows_the_work_to_be_reclaimed(monkeypatch, message):
    calls = []
    monkeypatch.setitem(runner.HANDLERS, "preprocess", lambda db, entity: calls.append(entity))

    with SessionLocal() as session:
        job = session.get(JobMessage, UUID(message))
        job.status = "running"
        job.leased_until = utcnow() - timedelta(seconds=1)
        session.commit()

    execute(message, "preprocess")
    assert len(calls) == 1
    assert reload(message).status == "completed"


def test_backoff_grows_and_is_capped():
    assert retry_delay(1) == 2
    assert retry_delay(2) == 4
    assert retry_delay(3) == 8
    assert retry_delay(20) == 256
    assert retry_delay(50) <= 300
