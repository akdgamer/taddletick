from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require
from app.db import get_session
from app.models import StageType
from app.schemas import StageTypeCreate, StageTypeRead

router = APIRouter(prefix="/stage-types", tags=["stage types"])


@router.get("", response_model=list[StageTypeRead])
def list_stage_types(session: Session = Depends(get_session)):
    return session.scalars(select(StageType).order_by(StageType.sort_order, StageType.id)).all()


@router.post("", response_model=StageTypeRead, status_code=201, dependencies=[Depends(require("can_edit"))])
def create_stage_type(body: StageTypeCreate, session: Session = Depends(get_session)):
    name = body.name.strip()
    if session.scalar(select(StageType).where(func.lower(StageType.name) == name.lower())):
        raise HTTPException(409, f"Stage type '{name}' already exists")
    next_order = (session.scalar(select(func.max(StageType.sort_order))) or 0) + 1
    stage_type = StageType(name=name, sort_order=next_order)
    session.add(stage_type)
    session.commit()
    return stage_type
