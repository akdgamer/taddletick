from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_session
from app.models import Project, ProjectStage, StageType
from app.schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectStageCreate,
    ProjectStageRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_or_404(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


def check_stage_types_exist(session: Session, ids: list[int]) -> None:
    found = set(session.scalars(select(StageType.id).where(StageType.id.in_(ids))))
    missing = set(ids) - found
    if missing:
        raise HTTPException(422, f"Unknown stage type ids: {sorted(missing)}")


@router.get("", response_model=list[ProjectRead])
def list_projects(completed: bool = False, session: Session = Depends(get_session)):
    """Plain list for browsing, e.g. completed projects; the dashboard handles urgency."""
    return session.scalars(
        select(Project)
        .where(Project.is_completed.is_(completed))
        .options(selectinload(Project.stages))
        .order_by(Project.updated_at.desc(), Project.id.desc())
    ).all()


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)):
    return get_project_or_404(session, project_id)


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    if len(set(body.stage_type_ids)) != len(body.stage_type_ids):
        raise HTTPException(422, "A stage can only be added to a project once")
    check_stage_types_exist(session, body.stage_type_ids)

    project = Project(**body.model_dump(exclude={"stage_type_ids"}))
    project.stages = [
        ProjectStage(stage_type_id=type_id, position=i)
        for i, type_id in enumerate(body.stage_type_ids)
    ]
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, body: ProjectUpdate, session: Session = Depends(get_session)):
    project = get_project_or_404(session, project_id)
    # exclude_unset: only fields the client actually sent are changed
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, session: Session = Depends(get_session)):
    session.delete(get_project_or_404(session, project_id))
    session.commit()


@router.post("/{project_id}/stages", response_model=ProjectStageRead, status_code=201)
def add_stage(project_id: int, body: ProjectStageCreate, session: Session = Depends(get_session)):
    project = get_project_or_404(session, project_id)
    check_stage_types_exist(session, [body.stage_type_id])
    if any(s.stage_type_id == body.stage_type_id for s in project.stages):
        raise HTTPException(409, "This stage is already on the project")

    next_position = session.scalar(
        select(func.coalesce(func.max(ProjectStage.position), -1) + 1).where(
            ProjectStage.project_id == project_id
        )
    )
    stage = ProjectStage(project_id=project_id, position=next_position, **body.model_dump())
    session.add(stage)
    session.commit()
    session.refresh(stage)
    return stage
