from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password, verify_password
from app.core.config import get_settings
from app.core.errors import DomainError
from app.models import User
from app.schemas.auth import RegisterRequest

DUMMY_HASH = hash_password("unused-password-for-timing-equalization")


def register(db: Session, data: RegisterRequest) -> User:
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise DomainError("EMAIL_UNAVAILABLE", "An account already uses this email.", 409)
    user = User(
        email=email,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()
    if get_settings().seed_on_register:
        from app.cli.seed import seed_for_user

        seed_for_user(db, user)
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    encoded = user.password_hash if user else DUMMY_HASH
    valid = verify_password(password, encoded)
    if not user or not valid or user.disabled:
        raise DomainError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)
    return user


def logout(db: Session, user: User) -> None:
    user.session_version += 1
    db.commit()
