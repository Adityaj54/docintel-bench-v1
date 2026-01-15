from pydantic import EmailStr, Field

from app.schemas.common import EntityRead, InputModel


class RegisterRequest(InputModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(InputModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(EntityRead):
    email: str
    display_name: str


class SessionRead(UserRead):
    csrf_token: str
