from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Query, Response, UploadFile
from sqlalchemy import select

from app.api.pagination import Limit, Offset, page
from app.auth.dependencies import AuthenticatedUser, Database
from app.core.errors import DomainError
from app.models import Document, GroundTruth
from app.schemas.common import Message, Page
from app.schemas.documents import DocumentRead, GroundTruthRead, GroundTruthWrite
from app.services import documents, ground_truth
from app.services.access import dataset_for, document_for
from app.storage.factory import get_storage

router = APIRouter(tags=["documents"])


@router.get("/datasets/{dataset_id}/documents", response_model=Page[DocumentRead])
def browse(dataset_id: UUID, db: Database, user: AuthenticatedUser,
           status: str | None = None, search: str = Query(default="", max_length=200),
           limit: Limit = 50, offset: Offset = 0):
    dataset_for(db, dataset_id, user)
    query = select(Document).where(Document.dataset_id == dataset_id, Document.deleted.is_(False))
    if status:
        query = query.where(Document.status == status)
    if search:
        query = query.where(Document.original_filename.icontains(search, autoescape=True))
    return page(db, query.order_by(Document.created_at.desc(), Document.id),
                limit, offset, documents.serialize)


@router.post("/datasets/{dataset_id}/documents", response_model=DocumentRead, status_code=201)
async def upload(dataset_id: UUID, file: UploadFile, db: Database, user: AuthenticatedUser):
    try:
        return documents.serialize(await documents.upload(db, user, dataset_id, file))
    finally:
        await file.close()


@router.get("/documents/{document_id}", response_model=DocumentRead)
def detail(document_id: UUID, db: Database, user: AuthenticatedUser):
    return documents.serialize(document_for(db, document_id, user))


@router.delete("/documents/{document_id}", response_model=Message)
def delete(document_id: UUID, db: Database, user: AuthenticatedUser):
    documents.delete(db, user, document_id)
    return {"message": "Document deleted."}


@router.post("/documents/{document_id}/retry", response_model=DocumentRead)
def retry(document_id: UUID, db: Database, user: AuthenticatedUser):
    return documents.serialize(documents.retry_preprocessing(db, user, document_id))


@router.get("/documents/{document_id}/original")
def original(document_id: UUID, db: Database, user: AuthenticatedUser):
    document = document_for(db, document_id, user)
    return Response(get_storage().get(document.storage_key), media_type=document.mime_type,
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" +
                             quote(document.original_filename), "Cache-Control": "private, no-store"})


@router.get("/documents/{document_id}/pages/{number}")
def artifact(document_id: UUID, number: int, db: Database, user: AuthenticatedUser):
    document = document_for(db, document_id, user)
    match = next((item for item in document.artifacts if item["page"] == number), None)
    if not match:
        raise DomainError("NOT_FOUND", "Page is not available.", 404)
    return Response(get_storage().get(match["storage_key"]), media_type=match["mime_type"],
                    headers={"Cache-Control": "private, no-store"})


@router.get("/documents/{document_id}/ground-truth", response_model=list[GroundTruthRead])
def truths(document_id: UUID, db: Database, user: AuthenticatedUser):
    document_for(db, document_id, user)
    return db.scalars(select(GroundTruth).where(GroundTruth.document_id == document_id)).all()


@router.put("/documents/{document_id}/ground-truth", response_model=GroundTruthRead)
def save_truth(document_id: UUID, data: GroundTruthWrite, db: Database, user: AuthenticatedUser):
    return ground_truth.write(db, user, document_id, data)
