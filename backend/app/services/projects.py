from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.models import Project, User
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.services.access import project_for


def list_projects(db: Session, user: User, archived: bool | None, search: str, limit: int, offset: int):
    filters = [Project.owner_id == user.id]
    if archived is not None:
        filters.append(Project.archived == archived)
    if search:
        filters.append(Project.name.icontains(search, autoescape=True))
    total = db.scalar(select(func.count()).select_from(Project).where(*filters)) or 0
    projects = db.scalars(
        select(Project).where(*filters).order_by(Project.updated_at.desc(), Project.id)
        .limit(limit).offset(offset)
    ).all()
    return {"items": projects, "total": total, "offset": offset, "limit": limit}


def create(db: Session, user: User, data: ProjectCreate) -> Project:
    project = Project(owner_id=user.id, **data.model_dump())
    db.add(project)
    db.flush()
    record(db, project_id=project.id, user_id=user.id, action="project.created",
           entity_type="project", entity_id=project.id, details={"name": project.name})
    db.commit()
    return project


def update(db: Session, user: User, identifier: UUID, data: ProjectUpdate) -> Project:
    project = project_for(db, identifier, user)
    previous = {"name": project.name, "description": project.description, "archived": project.archived}
    for key, value in data.model_dump().items():
        setattr(project, key, value)
    record(db, project_id=project.id, user_id=user.id, action="project.updated",
           entity_type="project", entity_id=project.id,
           details={"before": previous, "after": data.model_dump()})
    db.commit()
    return project
