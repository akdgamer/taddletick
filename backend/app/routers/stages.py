from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import ProjectStage
from app.schemas import ProjectStageRead, ProjectStageUpdate

router = APIRouter(prefix="/stages", tags=["project stages"])


def get_stage_or_404(session: Session, stage_id: int) -> ProjectStage:
    stage = session.get(ProjectStage, stage_id)
    if stage is None:
        raise HTTPException(404, "Stage not found")
    return stage


@router.patch("/{stage_id}", response_model=ProjectStageRead)
def update_stage(stage_id: int, body: ProjectStageUpdate, session: Session = Depends(get_session)):
    stage = get_stage_or_404(session, stage_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    session.commit()
    session.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204)
def delete_stage(stage_id: int, session: Session = Depends(get_session)):
    session.delete(get_stage_or_404(session, stage_id))
    session.commit()
