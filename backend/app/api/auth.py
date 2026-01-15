from fastapi import APIRouter, Request, Response

from app.auth.dependencies import AuthenticatedUser, Database
from app.auth.security import COOKIE_NAME, check_origin, issue_session, limit_auth
from app.schemas.auth import LoginRequest, RegisterRequest, SessionRead, UserRead
from app.schemas.common import Message
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=SessionRead, status_code=201)
def register(data: RegisterRequest, request: Request, response: Response, db: Database):
    check_origin(request)
    limit_auth(request, str(data.email))
    user = service.register(db, data)
    csrf = issue_session(response, user)
    return {**UserRead.model_validate(user).model_dump(), "csrf_token": csrf}


@router.post("/login", response_model=SessionRead)
def login(data: LoginRequest, request: Request, response: Response, db: Database):
    check_origin(request)
    limit_auth(request, str(data.email))
    user = service.authenticate(db, str(data.email), data.password)
    csrf = issue_session(response, user)
    return {**UserRead.model_validate(user).model_dump(), "csrf_token": csrf}


@router.get("/me", response_model=SessionRead)
def me(request: Request, user: AuthenticatedUser):
    return {
        **UserRead.model_validate(user).model_dump(),
        "csrf_token": request.state.csrf,
    }


@router.post("/logout", response_model=Message)
def logout(response: Response, user: AuthenticatedUser, db: Database):
    service.logout(db, user)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"message": "Signed out."}
