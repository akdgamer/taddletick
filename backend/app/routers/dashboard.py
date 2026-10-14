from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import urgency
from app.db import get_session
from app.models import Project
from app.schemas import (
    DashboardPayment,
    DashboardProject,
    DashboardStage,
    FileRead,
    PaymentRead,
    ProjectStageRead,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_today() -> date:
    """Separate dependency so tests can pin "today"."""
    return date.today()


@router.get("", response_model=list[DashboardProject])
def dashboard(session: Session = Depends(get_session), today: date = Depends(get_today)):
    projects = session.scalars(
        select(Project)
        .where(Project.is_completed.is_(False))
        .options(selectinload(Project.stages))
    ).unique().all()
    projects = sorted(projects, key=lambda p: urgency.sort_key(p, today))

    return [
        DashboardProject(
            id=p.id,
            name=p.name,
            client_id=p.client_id,
            client=p.client,
            po_number=p.po_number,
            label=p.label,
            is_p0=p.is_p0,
            dispatch_date=p.dispatch_date,
            notes=p.notes,
            flag=urgency.project_flag(p, today),
            dispatch_flag=urgency.dispatch_flag(p, today),
            days_to_dispatch=(p.dispatch_date - today).days if p.dispatch_date else None,
            stages=[
                DashboardStage(
                    **ProjectStageRead.model_validate(s).model_dump(),
                    flag=urgency.stage_flag(s, today),
                )
                for s in urgency.order_stages(p.stages)
            ],
            payments=[
                DashboardPayment(**PaymentRead.model_validate(pay).model_dump(), flag=urgency.payment_flag(pay, today))
                for pay in p.payments
            ],
            files=[FileRead.model_validate(f) for f in p.files],
        )
        for p in projects
    ]
