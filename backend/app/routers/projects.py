from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import auth
from app.auth import current_user
from app.db import get_session
from app.models import Project, ProjectLabel, ProjectStage, Role, StageType, User
from app.routers.clients import check_client_exists
from app.schemas import (
    PaymentRead,
    ProjectCreate,
    ProjectFields,
    ProjectRead,
    ProjectStageCreate,
    ProjectStageRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def get_visible_project(session: Session, project_id: int, user: User) -> Project:
    """404 both when it doesn't exist and when this user may not see it."""
    project = session.get(Project, project_id)
    if project is None or not auth.can_see(user, project):
        raise HTTPException(404, "Project not found")
    return project


def project_read(project: Project, user: User) -> ProjectRead:
    access = auth.access(user, project)
    return ProjectRead(
        **ProjectFields.model_validate(project).model_dump(),
        payments=[PaymentRead.model_validate(p) for p in project.payments] if access["can_view_payments"] else [],
        access=access,
    )


def check_stage_types_exist(session: Session, ids: list[int]) -> None:
    found = set(session.scalars(select(StageType.id).where(StageType.id.in_(ids))))
    missing = set(ids) - found
    if missing:
        raise HTTPException(422, f"Unknown stage type ids: {sorted(missing)}")


def load_roles(session: Session, ids: list[int], user: User) -> list[Role]:
    if ids and not user.role.is_admin:
        raise HTTPException(403, "Only admins can restrict a project to roles")
    roles = session.scalars(select(Role).where(Role.id.in_(ids))).all()
    if len(roles) != len(set(ids)):
        raise HTTPException(422, "Unknown role id")
    return list(roles)


@router.get("", response_model=list[ProjectRead])
def list_projects(
    completed: bool = False, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    """Plain list for browsing, e.g. completed projects; the dashboard handles urgency."""
    projects = session.scalars(
        select(Project)
        .where(Project.is_completed.is_(completed))
        .options(selectinload(Project.stages))
        .order_by(Project.updated_at.desc(), Project.id.desc())
    ).unique().all()
    return [project_read(p, user) for p in projects if auth.can_see(user, p)]


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    return project_read(get_visible_project(session, project_id, user), user)


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, session: Session = Depends(get_session), user: User = Depends(current_user)):
    # Anyone may keep personal projects; shared ones need an editing role
    if body.label == ProjectLabel.company:
        auth.check(user.allowed("can_edit"), "Your role can't create company projects")
    if len(set(body.stage_type_ids)) != len(body.stage_type_ids):
        raise HTTPException(422, "A stage can only be added to a project once")
    check_stage_types_exist(session, body.stage_type_ids)
    check_client_exists(session, body.client_id)
    roles = load_roles(session, body.allowed_role_ids, user) if body.label == ProjectLabel.company else []

    project = Project(**body.model_dump(exclude={"stage_type_ids", "allowed_role_ids"}), owner_id=user.id)
    project.allowed_roles = roles
    project.stages = [
        ProjectStage(stage_type_id=type_id, position=i)
        for i, type_id in enumerate(body.stage_type_ids)
    ]
    session.add(project)
    session.commit()
    session.refresh(project)
    return project_read(project, user)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, body: ProjectUpdate, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    project = get_visible_project(session, project_id, user)
    auth.check(auth.can_edit(user, project))
    # exclude_unset: only fields the client actually sent are changed
    changes = body.model_dump(exclude_unset=True)
    if "client_id" in changes:
        check_client_exists(session, changes["client_id"])

    new_label = changes.get("label", project.label)
    if new_label != project.label:
        # Making it personal hides it from everyone else; only its creator may do that
        if new_label == ProjectLabel.personal:
            auth.check(project.owner_id == user.id, "Only the person who created a project can make it personal")
        else:
            auth.check(user.allowed("can_edit"), "Your role can't create company projects")
    if "allowed_role_ids" in changes:
        project.allowed_roles = load_roles(session, changes.pop("allowed_role_ids") or [], user)
    if new_label == ProjectLabel.personal:
        project.allowed_roles = []

    for field, value in changes.items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return project_read(project, user)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    from app.routers.files import delete_project_files  # avoid a circular import

    project = get_visible_project(session, project_id, user)
    auth.check(auth.can_delete(user, project))
    session.delete(project)
    session.commit()
    delete_project_files(project_id)


@router.post("/{project_id}/stages", response_model=ProjectStageRead, status_code=201)
def add_stage(
    project_id: int, body: ProjectStageCreate, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    project = get_visible_project(session, project_id, user)
    auth.check(auth.can_edit(user, project))
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
