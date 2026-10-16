"""Reading the activity history, filtered to what the reader may see."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth
from app.auth import current_user
from app.db import get_session
from app.models import Activity, User
from app.schemas import ActivityPage, ActivityRead, UserRef

router = APIRouter(prefix="/activity", tags=["activity"])

BATCH = 200


def visible(row: Activity, user: User) -> bool:
    if row.project is None:
        # A deleted project: admins and whoever deleted it
        return user.role.is_admin or row.user_id == user.id
    if not auth.can_see(user, row.project):
        return False
    return not row.sensitive or auth.can_view_payments(user, row.project)


@router.get("", response_model=ActivityPage)
def list_activity(
    project_id: int | None = None,
    user_id: int | None = None,
    before: int | None = Query(None, description="Older than this activity id (for paging)"),
    limit: int = Query(30, ge=1, le=100),
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
):
    """Newest first. Rows the reader can't see are skipped, so pages are filled in batches."""
    items: list[Activity] = []
    cursor = before
    while len(items) < limit:
        query = select(Activity).order_by(Activity.id.desc()).limit(BATCH)
        if cursor is not None:
            query = query.where(Activity.id < cursor)
        if project_id is not None:
            query = query.where(Activity.project_id == project_id)
        if user_id is not None:
            query = query.where(Activity.user_id == user_id)
        batch = session.scalars(query).unique().all()
        if not batch:
            break
        for row in batch:
            if visible(row, user):
                items.append(row)
                if len(items) == limit:
                    break
        cursor = batch[-1].id
        if len(batch) < BATCH:
            break
    more = len(items) == limit
    return ActivityPage(
        items=[
            ActivityRead(
                id=a.id, at=a.at, kind=a.kind, summary=a.summary, project_id=a.project_id,
                project_name=a.project.name if a.project else a.project_name,
                user=UserRef.model_validate(a.user) if a.user else None,
            )
            for a in items
        ],
        next_before=items[-1].id if more else None,
    )
