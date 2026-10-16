import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require
from app.db import get_session
from app.models import StageType
from app.schemas import StageTypeCreate, StageTypeRead

router = APIRouter(prefix="/stage-types", tags=["stage types"])


def same_name(name: str) -> str:
    """Case, spacing and punctuation don't make a different stage ("Testing & QA" = "testing qa")."""
    return " ".join(re.sub(r"[\W_]+", " ", name.lower()).split())


@router.get("", response_model=list[StageTypeRead])
def list_stage_types(session: Session = Depends(get_session)):
    return session.scalars(select(StageType).order_by(StageType.sort_order, StageType.id)).all()


@router.post("", response_model=StageTypeRead, status_code=201, dependencies=[Depends(require("can_edit"))])
def create_stage_type(body: StageTypeCreate, session: Session = Depends(get_session)):
    name = " ".join(body.name.split())
    existing = next((t for t in session.scalars(select(StageType)) if same_name(t.name) == same_name(name)), None)
    if existing:
        raise HTTPException(409, f"'{existing.name}' already exists")
    next_order = (session.scalar(select(func.max(StageType.sort_order))) or 0) + 1
    stage_type = StageType(name=name, sort_order=next_order)
    session.add(stage_type)
    session.commit()
    return stage_type
