import hashlib
import os
import secrets
import time
from datetime import timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request, Response
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.time import utcnow
from app.models import User

hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
COOKIE_NAME = "docintel_session"


@lru_cache
def signing_key() -> str:
    settings = get_settings()
    if settings.secret_key:
        if len(settings.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must contain at least 32 characters.")
        return settings.secret_key
    if settings.environment == "production":
        raise RuntimeError("Production requires an explicit SECRET_KEY.")
    directory = settings.storage_root.parent / ".secrets"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    filename = directory / "session.key"
    try:
        descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        for _ in range(20):
            value = filename.read_text().strip()
            if len(value) >= 32:
                return value
            time.sleep(0.05)
        raise RuntimeError("Stored session key is incomplete.")
    with os.fdopen(descriptor, "w") as output:
        value = secrets.token_urlsafe(48)
        output.write(value)
        output.flush()
        os.fsync(output.fileno())
    return value


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def issue_session(response: Response, user: User) -> str:
    settings = get_settings()
    csrf = secrets.token_urlsafe(24)
    now = utcnow()
    payload = {
        "sub": str(user.id),
        "ver": user.session_version,
        "csrf": csrf,
        "iat": now,
        "exp": now + timedelta(hours=settings.session_hours),
        "iss": "docintel-bench",
        "aud": "docintel-browser",
    }
    token = jwt.encode(payload, signing_key(), algorithm="HS256")
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=settings.session_hours * 3600,
    )
    return csrf


def decode_session(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise DomainError("UNAUTHENTICATED", "Sign in to continue.", 401)
    try:
        return jwt.decode(
            token,
            signing_key(),
            algorithms=["HS256"],
            issuer="docintel-bench",
            audience="docintel-browser",
            options={"require": ["exp", "sub", "ver", "csrf", "iat"]},
        )
    except jwt.InvalidTokenError as exc:
        raise DomainError("SESSION_EXPIRED", "Your session expired. Sign in again.", 401) from exc


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in get_settings().origins:
        raise DomainError("INVALID_ORIGIN", "This origin is not permitted.", 403)


def check_csrf(request: Request, payload: dict) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    check_origin(request)
    supplied = request.headers.get("X-CSRF-Token", "")
    expected = payload.get("csrf", "")
    if not supplied or not secrets.compare_digest(supplied, expected):
        raise DomainError("CSRF_FAILED", "Refresh this page and try again.", 403)


def limit_auth(request: Request, email: str) -> None:
    settings = get_settings()
    if settings.environment == "test":
        return
    address = request.client.host if request.client else "unknown"
    identity = hashlib.sha256(f"{address}:{email.lower()}".encode()).hexdigest()
    key = f"auth-limit:{identity}"
    try:
        redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        with redis.pipeline() as pipeline:
            pipeline.incr(key)
            pipeline.expire(key, 300)
            count, _ = pipeline.execute()
    except RedisError as exc:
        raise DomainError("AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.", 503) from exc
    if count > 20:
        raise DomainError("RATE_LIMITED", "Too many attempts. Try again in five minutes.", 429)
