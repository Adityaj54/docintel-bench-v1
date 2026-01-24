from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import InputModel, UpdatedRead


class ArtifactRead(InputModel):
    page: int
    width: int
    height: int
    mime_type: str
    url: str


class DocumentRead(UpdatedRead):
    dataset_id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    page_count: int
    width: int | None
    height: int | None
    status: str
    error: dict[str, Any] | None
    uploaded_by: UUID
    artifacts: list[ArtifactRead] = Field(default_factory=list)


class GroundTruthWrite(InputModel):
    schema_id: UUID
    value: Any
    expected_version: int | None = Field(default=None, ge=1)
    source: str = Field(default="manual", pattern="^(manual|import)$")


class GroundTruthPromote(InputModel):
    expected_version: int | None = Field(default=None, ge=1)


class GroundTruthRead(UpdatedRead):
    document_id: UUID
    schema_id: UUID
    value: Any
    version: int
    source: str
    updated_by: UUID
