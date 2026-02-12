from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from app.api.pagination import Limit, Offset, page
from app.auth.dependencies import AuthenticatedUser, Database
from app.models import ExtractionResult, ExtractionRun, ProviderConfiguration
from app.schemas.common import Page
from app.schemas.documents import GroundTruthPromote, GroundTruthRead
from app.schemas.runs import ProviderCreate, ProviderRead, ResultRead, RunCreate, RunRead
from app.services import ground_truth, providers, runs
from app.services.access import project_for, result_for, run_for

router = APIRouter(tags=["extractions"])


@router.get("/projects/{project_id}/providers", response_model=Page[ProviderRead])
def provider_list(project_id: UUID, db: Database, user: AuthenticatedUser,
                  limit: Limit = 100, offset: Offset = 0):
    project_for(db, project_id, user)
    query = select(ProviderConfiguration).where(
        ProviderConfiguration.project_id == project_id
    ).order_by(ProviderConfiguration.name, ProviderConfiguration.id)
    return page(db, query, limit, offset, providers.serialize)


@router.post("/projects/{project_id}/providers", response_model=ProviderRead, status_code=201)
def provider_create(project_id: UUID, data: ProviderCreate, db: Database, user: AuthenticatedUser):
    return providers.serialize(providers.create(db, user, project_id, data))


@router.put("/providers/{provider_id}", response_model=ProviderRead)
def provider_update(provider_id: UUID, data: ProviderCreate, db: Database, user: AuthenticatedUser):
    return providers.serialize(providers.update(db, user, provider_id, data))


@router.get("/projects/{project_id}/runs", response_model=Page[RunRead])
def browse(project_id: UUID, db: Database, user: AuthenticatedUser, status: str | None = None,
           limit: Limit = 50, offset: Offset = 0):
    project_for(db, project_id, user)
    query = select(ExtractionRun).where(ExtractionRun.project_id == project_id)
    if status:
        query = query.where(ExtractionRun.status == status)
    return page(db, query.order_by(ExtractionRun.created_at.desc(), ExtractionRun.id), limit, offset)


@router.post("/projects/{project_id}/runs", response_model=RunRead, status_code=201)
def create(project_id: UUID, data: RunCreate, db: Database, user: AuthenticatedUser):
    return runs.create(db, user, project_id, data)


@router.get("/runs/{run_id}", response_model=RunRead)
def detail(run_id: UUID, db: Database, user: AuthenticatedUser):
    return run_for(db, run_id, user)


@router.post("/runs/{run_id}/cancel", response_model=RunRead)
def cancel(run_id: UUID, db: Database, user: AuthenticatedUser):
    return runs.cancel(db, user, run_id)


@router.get("/runs/{run_id}/results", response_model=Page[ResultRead])
def results(run_id: UUID, db: Database, user: AuthenticatedUser, status: str | None = None,
            limit: Limit = 50, offset: Offset = 0):
    run_for(db, run_id, user)
    query = select(ExtractionResult).where(ExtractionResult.run_id == run_id)
    if status:
        query = query.where(ExtractionResult.status == status)
    return page(db, query.order_by(ExtractionResult.created_at, ExtractionResult.id), limit, offset,
                lambda row: runs.serialize_result(db, row, include_raw=False))


@router.get("/results/{result_id}", response_model=ResultRead)
def result_detail(result_id: UUID, db: Database, user: AuthenticatedUser):
    return runs.serialize_result(db, result_for(db, result_id, user))


@router.post("/results/{result_id}/promote", response_model=GroundTruthRead)
def promote(result_id: UUID, data: GroundTruthPromote, db: Database, user: AuthenticatedUser):
    return ground_truth.promote(db, user, result_id, data.expected_version)
