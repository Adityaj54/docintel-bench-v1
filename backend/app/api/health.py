from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.time import utcnow
from app.db.session import SessionLocal
from app.schemas.operations import HealthRead

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthRead)
def health():
    return HealthRead(status="ok", checked_at=utcnow())


@router.get("/health/ready", response_model=HealthRead)
def ready():
    database = redis = False
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            database = True
    except SQLAlchemyError:
        pass
    try:
        client = Redis.from_url(get_settings().redis_url, socket_connect_timeout=2, socket_timeout=2)
        redis = bool(client.ping())
        client.close()
    except RedisError:
        pass
    result = HealthRead(status="ready" if database and redis else "unavailable",
                        database=database, redis=redis, checked_at=utcnow())
    return JSONResponse(result.model_dump(mode="json"), status_code=200 if database and redis else 503)
