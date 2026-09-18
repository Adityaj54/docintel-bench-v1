from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.auth.dependencies import AuthenticatedUser, Database
from app.core.errors import DomainError
from app.metrics.service import provider_metric, report, result_rows, significance_report
from app.schemas.operations import MetricReport, RunComparison, RunSignificance
from app.services.access import project_for, run_for

router = APIRouter(tags=["metrics"])


@router.get("/projects/{project_id}/metrics", response_model=MetricReport)
def metrics(project_id: UUID, db: Database, user: AuthenticatedUser,
            since: datetime | None = None, until: datetime | None = None):
    project_for(db, project_id, user)
    if since and until and since > until:
        raise DomainError("INVALID_DATE_RANGE", "Start date must precede end date.")
    return report(db, project_id, since, until)


def runs_in_project(db, project_id: UUID, user, run_ids: list[UUID]):
    runs = []
    for identifier in dict.fromkeys(run_ids):
        run = run_for(db, identifier, user)
        if run.project_id != project_id:
            raise DomainError("NOT_FOUND", "Run not found in this project.", 404)
        runs.append(run)
    return runs


@router.get("/projects/{project_id}/comparison", response_model=list[RunComparison])
def comparison(project_id: UUID, db: Database, user: AuthenticatedUser,
               run_ids: Annotated[list[UUID], Query(min_length=2, max_length=8)]):
    project_for(db, project_id, user)
    compared = []
    for run in runs_in_project(db, project_id, user, run_ids):
        snapshot = run.provider_snapshot
        compared.append(RunComparison(
            run_id=run.id, name=run.name, status=run.status,
            metrics=provider_metric(result_rows(db, project_id, [run.id]),
                                    snapshot["provider"], snapshot["model"]),
        ))
    return compared


@router.get("/projects/{project_id}/comparison/significance",
            response_model=list[RunSignificance])
def comparison_significance(project_id: UUID, db: Database, user: AuthenticatedUser,
                            run_ids: Annotated[list[UUID], Query(min_length=2, max_length=8)]):
    """Test every run against the first over the documents they share."""
    project_for(db, project_id, user)
    runs = runs_in_project(db, project_id, user, run_ids)
    if len(runs) < 2:
        raise DomainError("INVALID_COMPARISON", "Comparison needs two distinct runs.")
    return significance_report(db, runs)
