from celery import Celery

from app.core.config import get_settings

celery = Celery("docintel", broker=get_settings().redis_url, include=["app.jobs.tasks"])
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    broker_transport_options={"visibility_timeout": 600},
    task_time_limit=240,
    task_soft_time_limit=220,
    beat_schedule={
        "dispatch-pending-jobs": {
            "task": "docintel.dispatch",
            "schedule": 3.0,
        },
    },
)
