from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.auth.dependencies import AuthenticatedUser, Database
from app.core.errors import DomainError
from app.metrics.service import provider_metric, report, result_rows
from app.schemas.operations import MetricReport, RunComparison
from app.services.access import project_for, run_for

router = APIRouter(tags=["metrics"])


@router.get("/projects/{project_id}/metrics", response_model=MetricReport)
def metrics(project_id: UUID, db: Database, user: AuthenticatedUser,
            since: datetime | None = None, until: datetime | None = None):
    project_for(db, project_id, user)
    if since and until and since > until:
        raise DomainError("INVALID_DATE_RANGE", "Start date must precede end date.")
    return report(db, project_id, since, until)


@router.get("/projects/{project_id}/comparison", response_model=list[RunComparison])
def comparison(project_id: UUID, db: Database, user: AuthenticatedUser,
               run_ids: Annotated[list[UUID], Query(min_length=2, max_length=8)]):
    project_for(db, project_id, user)
    compared = []
    for identifier in dict.fromkeys(run_ids):
        run = run_for(db, identifier, user)
        if run.project_id != project_id:
            raise DomainError("NOT_FOUND", "Run not found in this project.", 404)
        snapshot = run.provider_snapshot
        compared.append(RunComparison(
            run_id=run.id, name=run.name, status=run.status,
            metrics=provider_metric(result_rows(db, project_id, [identifier]),
                                    snapshot["provider"], snapshot["model"]),
        ))
    return compared
