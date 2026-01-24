from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import InputModel, UpdatedRead


class ProjectCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)


class ProjectUpdate(ProjectCreate):
    archived: bool = False


class ProjectRead(UpdatedRead):
    owner_id: UUID
    name: str
    description: str
    archived: bool


class SchemaCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)
    definition: dict[str, Any]


class SchemaVersion(InputModel):
    definition: dict[str, Any]
    description: str = Field(default="", max_length=4000)


class SchemaClone(InputModel):
    name: str = Field(min_length=1, max_length=120)


class SchemaActivation(InputModel):
    active: bool


class SchemaRead(UpdatedRead):
    project_id: UUID
    name: str
    description: str
    version: int
    definition: dict[str, Any]
    active: bool
    created_by: UUID


class SampleValidation(InputModel):
    value: Any


class ValidationIssue(InputModel):
    path: str
    validator: str | None
    expected: Any
    received: Any = None
    received_type: str
    message: str


class SampleValidationRead(InputModel):
    valid: bool
    errors: list[ValidationIssue]
    error_count: int


class DatasetCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)


class DatasetRead(UpdatedRead):
    project_id: UUID
    name: str
    description: str
    document_count: int = 0
