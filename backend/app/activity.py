"""Activity history: each change becomes one readable line ("Software: In progress → Done").

Routers call record() before committing, so the line and the change are saved together.
"""

import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Activity, Project, User

MAX_SHOWN = 60  # longer values (notes) are cut in the summary


def record(session: Session, user: User, project: Project, summary: str, kind: str = "project",
           sensitive: bool = False) -> None:
    session.add(Activity(user_id=user.id, project_id=project.id, project_name=project.name,
                         kind=kind, summary=summary, sensitive=sensitive))


def record_project_deleted(session: Session, user: User, project: Project) -> None:
    """A project's history goes with it; one line remains (for admins and whoever deleted it)."""
    session.execute(delete(Activity).where(Activity.project_id == project.id))
    session.add(Activity(user_id=user.id, project_id=None, project_name=project.name,
                         kind="project", summary="deleted the project"))


def show(value) -> str:
    """A value as people write it: dates as "24 Oct 2026", money without trailing zeros."""
    if value is None or value == "":
        return "none"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, date):
        return f"{value.day} {value:%b %Y}"
    if isinstance(value, (float, Decimal)):
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    if isinstance(value, enum.Enum):
        return str(value.value)
    text = str(value)
    return text if len(text) <= MAX_SHOWN else text[: MAX_SHOWN - 1] + "…"


def diff(obj, new: dict, labels: dict[str, str]) -> list[str]:
    """'dispatch date 19 Oct 2026 → 24 Oct 2026' for each labelled field that really changes.
    Call before applying the changes."""
    return [
        f"{labels[field]} {show(getattr(obj, field))} → {show(value)}"
        for field, value in new.items()
        if field in labels and getattr(obj, field) != value
    ]


def money(value) -> str:
    return show(Decimal(str(value)))
