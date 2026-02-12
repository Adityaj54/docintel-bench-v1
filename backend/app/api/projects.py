from uuid import UUID

from fastapi import APIRouter, Query

from app.api.pagination import Limit, Offset
from app.auth.dependencies import AuthenticatedUser, Database
from app.schemas.common import Page
from app.schemas.projects import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import projects
from app.services.access import project_for

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=Page[ProjectRead])
def browse(db: Database, user: AuthenticatedUser, archived: bool | None = None,
           search: str = Query(default="", max_length=120), limit: Limit = 50, offset: Offset = 0):
    return projects.list_projects(db, user, archived, search, limit, offset)


@router.post("/projects", response_model=ProjectRead, status_code=201)
def create(data: ProjectCreate, db: Database, user: AuthenticatedUser):
    return projects.create(db, user, data)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def detail(project_id: UUID, db: Database, user: AuthenticatedUser):
    return project_for(db, project_id, user)


@router.put("/projects/{project_id}", response_model=ProjectRead)
def update(project_id: UUID, data: ProjectUpdate, db: Database, user: AuthenticatedUser):
    return projects.update(db, user, project_id, data)
