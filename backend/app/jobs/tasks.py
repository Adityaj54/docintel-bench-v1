from app.jobs.celery_app import celery
from app.jobs.runner import dispatch, execute


@celery.task(name="docintel.dispatch")
def dispatch_task() -> int:
    return dispatch()


@celery.task(name="docintel.preprocess")
def preprocess_task(identifier: str) -> None:
    execute(identifier, "preprocess")


@celery.task(name="docintel.extract")
def extract_task(identifier: str) -> None:
    execute(identifier, "extract")


@celery.task(name="docintel.validate")
def validate_task(identifier: str) -> None:
    execute(identifier, "validate")


@celery.task(name="docintel.evaluate")
def evaluate_task(identifier: str) -> None:
    execute(identifier, "evaluate")


@celery.task(name="docintel.webhook")
def webhook_task(identifier: str) -> None:
    execute(identifier, "webhook")
