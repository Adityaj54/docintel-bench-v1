from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EntityRead(ReadModel):
    id: UUID
    created_at: datetime


class UpdatedRead(EntityRead):
    updated_at: datetime


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    offset: int
    limit: int


class Message(BaseModel):
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody
