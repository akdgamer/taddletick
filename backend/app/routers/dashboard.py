from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import auth, urgency
from app.auth import current_user
from app.db import get_session
from app.models import Project, User
from app.schemas import (
    DashboardPayment,
    DashboardProject,
    DashboardStage,
    FileRead,
    PaymentRead,
    ProjectAccess,
    ProjectStageRead,
    UserRef,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_today() -> date:
    """Separate dependency so tests can pin "today"."""
    return date.today()


@router.get("", response_model=list[DashboardProject])
def dashboard(
    session: Session = Depends(get_session), today: date = Depends(get_today), user: User = Depends(current_user)
):
    projects = session.scalars(
        select(Project)
        .where(Project.is_completed.is_(False))
        .options(selectinload(Project.stages))
    ).unique().all()
    visible = [(p, auth.access(user, p)) for p in projects if auth.can_see(user, p)]
    visible.sort(key=lambda pa: urgency.sort_key(pa[0], today, pa[1]["can_view_payments"]))

    return [
        DashboardProject(
            id=p.id,
            name=p.name,
            client_id=p.client_id,
            client=p.client,
            owner=UserRef.model_validate(p.owner) if p.owner else None,
            allowed_role_ids=p.allowed_role_ids,
            access=ProjectAccess(**access),
            po_number=p.po_number,
            label=p.label,
            is_p0=p.is_p0,
            dispatch_date=p.dispatch_date,
            notes=p.notes,
            flag=urgency.project_flag(p, today, access["can_view_payments"]),
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
                for pay in (p.payments if access["can_view_payments"] else [])
            ],
            files=[FileRead.model_validate(f) for f in p.files],
        )
        for p, access in visible
    ]
