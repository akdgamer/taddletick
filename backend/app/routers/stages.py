from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import activity, auth
from app.auth import current_user
from app.db import get_session
from app.models import Contact, ProjectStage, StageStatus, User
from app.schemas import ProjectStageRead, ProjectStageUpdate

router = APIRouter(prefix="/stages", tags=["project stages"])

STATUS_NAMES = {
    StageStatus.not_started: "Not started",
    StageStatus.in_progress: "In progress",
    StageStatus.blocked: "Blocked",
    StageStatus.done: "Done",
}


def get_stage_or_404(session: Session, stage_id: int, user: User, permission=auth.can_edit) -> ProjectStage:
    """The stage, if its project is visible to the user and they hold `permission` on it."""
    stage = session.get(ProjectStage, stage_id)
    if stage is None or not auth.can_see(user, stage.project):
        raise HTTPException(404, "Stage not found")
    auth.check(permission(user, stage.project))
    return stage


@router.patch("/{stage_id}", response_model=ProjectStageRead)
def update_stage(stage_id: int, body: ProjectStageUpdate, session: Session = Depends(get_session), user: User = Depends(current_user)):
    stage = get_stage_or_404(session, stage_id, user)
    changes = body.model_dump(exclude_unset=True)
    lines = []
    if "status" in changes and changes["status"] != stage.status:
        lines.append(f"{STATUS_NAMES[stage.status]} → {STATUS_NAMES[changes['status']]}")
    lines += activity.diff(stage, changes, {"due_date": "due date"})
    if "notes" in changes and changes["notes"] != stage.notes:
        lines.append("updated its notes")
    for field, value in changes.items():
        setattr(stage, field, value)
    if lines:
        activity.record(session, user, stage.project, f"updated {stage.name}: {'; '.join(lines)}", kind="stage")
    session.commit()
    session.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204)
def delete_stage(stage_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    # Removing a stage loses its dates and notes, so it counts as deleting
    stage = get_stage_or_404(session, stage_id, user, auth.can_delete)
    activity.record(session, user, stage.project, f"removed stage {stage.name}", kind="stage")
    session.delete(stage)
    session.commit()


@router.post("/{stage_id}/contacts/{contact_id}", response_model=ProjectStageRead)
def add_stakeholder(stage_id: int, contact_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    stage = get_stage_or_404(session, stage_id, user)
    contact = session.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(404, "Contact not found")
    if contact not in stage.contacts:  # adding twice is harmless
        stage.contacts.append(contact)
        activity.record(session, user, stage.project, f"added {contact.name} to {stage.name}", kind="stage")
        session.commit()
        session.refresh(stage)
    return stage


@router.delete("/{stage_id}/contacts/{contact_id}", response_model=ProjectStageRead)
def remove_stakeholder(stage_id: int, contact_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    stage = get_stage_or_404(session, stage_id, user)
    removed = [c for c in stage.contacts if c.id == contact_id]
    stage.contacts = [c for c in stage.contacts if c.id != contact_id]
    if removed:
        activity.record(session, user, stage.project, f"removed {removed[0].name} from {stage.name}", kind="stage")
    session.commit()
    session.refresh(stage)
    return stage
