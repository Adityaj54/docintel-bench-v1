from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamped


class ExtractionSchema(Timestamped, Base):
    __tablename__ = "extraction_schemas"
    __table_args__ = (UniqueConstraint("project_id", "name", "version"),)

    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    definition: Mapped[dict[str, Any]] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))


class Dataset(Timestamped, Base):
    __tablename__ = "datasets"
    __table_args__ = (UniqueConstraint("project_id", "name"),)

    project_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")


class Document(Timestamped, Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("dataset_id", "sha256"),)

    dataset_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("datasets.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    page_count: Mapped[int] = mapped_column(Integer, default=1)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    artifacts: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    error: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_by: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))


class GroundTruth(Timestamped, Base):
    __tablename__ = "ground_truths"
    __table_args__ = (UniqueConstraint("document_id", "schema_id"),)

    document_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("documents.id"), index=True)
    schema_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("extraction_schemas.id"))
    value: Mapped[Any] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(30), default="manual")
    updated_by: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"))
