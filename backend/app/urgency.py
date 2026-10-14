"""Urgency rules for the dashboard.

Kept free of FastAPI and database code so every client (dashboard, future
iPhone view, calendar sync) gets the same answer, and so the rules are easy
to test with a fixed "today".

Rules:
- red:   a stage is past its due date and not done, or dispatch date has passed
- amber: a stage is blocked or due within STAGE_SOON_DAYS,
         or dispatch is within DISPATCH_SOON_DAYS
- payments: red when past due and not fully received, amber when due within
         PAYMENT_SOON_DAYS; they count towards the project's flag
- order: company before personal, then anything red, then P0,
         then the nearest open date (dispatch, unfinished stage, unpaid payment)
"""

import enum
from datetime import date

from app.models import Payment, Project, ProjectLabel, ProjectStage, StageStatus

STAGE_SOON_DAYS = 3
DISPATCH_SOON_DAYS = 7
PAYMENT_SOON_DAYS = 7


class Flag(str, enum.Enum):
    red = "red"
    amber = "amber"
    none = "none"


def stage_flag(stage: ProjectStage, today: date) -> Flag:
    if stage.status == StageStatus.done:
        return Flag.none
    if stage.due_date is not None and stage.due_date < today:
        return Flag.red
    if stage.status == StageStatus.blocked:
        return Flag.amber
    if stage.due_date is not None and (stage.due_date - today).days <= STAGE_SOON_DAYS:
        return Flag.amber
    return Flag.none


def dispatch_flag(project: Project, today: date) -> Flag:
    if project.dispatch_date is None:
        return Flag.none
    days_left = (project.dispatch_date - today).days
    if days_left < 0:
        return Flag.red
    if days_left <= DISPATCH_SOON_DAYS:
        return Flag.amber
    return Flag.none


def payment_flag(payment: Payment, today: date) -> Flag:
    if payment.is_paid or payment.due_date is None:
        return Flag.none
    days_left = (payment.due_date - today).days
    if days_left < 0:
        return Flag.red
    if days_left <= PAYMENT_SOON_DAYS:
        return Flag.amber
    return Flag.none


def project_flag(project: Project, today: date) -> Flag:
    flags = (
        [dispatch_flag(project, today)]
        + [stage_flag(s, today) for s in project.stages]
        + [payment_flag(p, today) for p in project.payments]
    )
    if Flag.red in flags:
        return Flag.red
    if Flag.amber in flags:
        return Flag.amber
    return Flag.none


def nearest_open_date(project: Project) -> date | None:
    dates = [s.due_date for s in project.stages if s.status != StageStatus.done and s.due_date]
    dates += [p.due_date for p in project.payments if not p.is_paid and p.due_date]
    if project.dispatch_date:
        dates.append(project.dispatch_date)
    return min(dates, default=None)


def sort_key(project: Project, today: date) -> tuple:
    nearest = nearest_open_date(project)
    return (
        project.label == ProjectLabel.personal,
        project_flag(project, today) != Flag.red,
        not project.is_p0,
        nearest is None,  # projects with no dates go last within their group
        nearest or date.max,
    )


def order_stages(stages: list[ProjectStage]) -> list[ProjectStage]:
    """Unfinished stages first in their set order; done stages at the bottom."""
    return sorted(stages, key=lambda s: (s.status == StageStatus.done, s.position))
