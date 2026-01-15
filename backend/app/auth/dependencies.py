from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth.security import check_csrf, decode_session
from app.core.errors import DomainError
from app.db.session import get_db
from app.models import User

Database = Annotated[Session, Depends(get_db)]


def current_user(request: Request, db: Database) -> User:
    payload = decode_session(request)
    try:
        user = db.get(User, UUID(payload["sub"]))
    except (ValueError, TypeError):
        user = None
    if not user or user.disabled or user.session_version != payload["ver"]:
        raise DomainError("SESSION_EXPIRED", "Your session is no longer active.", 401)
    check_csrf(request, payload)
    request.state.csrf = payload["csrf"]
    return user


AuthenticatedUser = Annotated[User, Depends(current_user)]
