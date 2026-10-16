"""The desk display on the Pi's little touch screen: one read-mostly summary, plus ticking today's tasks.

A display logs in with a one-time code made on the Pi (python -m app.pair_display USERNAME); its
login only works here. Anyone logged in normally can open the same page to try it out.
"""

import hashlib
import shutil
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import auth
from app.auth import current_user, display_user
from app.config import settings
from app.db import get_session
from app.models import DisplayPairing, GoogleAccount, User, UserSession
from app.routers import tasks as task_routes
from app.routers.dashboard import dashboard, get_today
from app.schemas import (
    DashboardProject,
    DisplayAlert,
    DisplayData,
    DisplayDispatch,
    DisplayHealth,
    DisplayTask,
    PairBody,
)
from app.urgency import Flag

router = APIRouter(prefix="/display", tags=["display"])

DISPLAY_SESSION_DAYS = 3650  # stays paired until unpaired in Settings
PAIRING_LOCK_NAME = "#display-pairing"  # wrong codes share one guessing limit
MAX_ALERTS = 5


def code_hash(code: str) -> str:
    return hashlib.sha256(code.strip().upper().replace("-", "").encode()).hexdigest()


@router.post("/pair", status_code=204)
def pair(body: PairBody, response: Response, session: Session = Depends(get_session)):
    auth.check_not_locked(session, PAIRING_LOCK_NAME)
    pairing = session.get(DisplayPairing, code_hash(body.code))
    if pairing is None or pairing.expires_at < datetime.now(timezone.utc) or not pairing.user.is_active:
        auth.record_failure(session, PAIRING_LOCK_NAME)
        raise HTTPException(400, "That code is wrong or has expired. Make a new one on the Pi.")
    user = pairing.user
    session.delete(pairing)  # one use only
    auth.start_session(session, response, user, scope="display", days=DISPLAY_SESSION_DAYS)


@router.get("/paired")
def paired_displays(session: Session = Depends(get_session), user: User = Depends(current_user)) -> dict:
    count = session.scalar(
        select(func.count()).where(UserSession.user_id == user.id, UserSession.scope == "display")
    )
    return {"count": count}


@router.delete("/paired", status_code=204)
def unpair_all(session: Session = Depends(get_session), user: User = Depends(current_user)):
    session.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.scope == "display"))
    session.commit()


@router.get("/data", response_model=DisplayData)
def data(session: Session = Depends(get_session), today: date = Depends(get_today), user: User = Depends(display_user)):
    projects = dashboard(session=session, today=today, user=user)
    return DisplayData(
        name=user.display_name,
        today=today,
        tasks=[
            DisplayTask(
                id=t.id, title=t.title, done=t.done, days_overdue=t.days_overdue,
                project=t.project.name if t.project else None,
            )
            for t in task_routes.today_tasks(session=session, today=today, user=user)
        ],
        alerts=[a for a in (alert_for(p, today) for p in projects) if a][:MAX_ALERTS],
        next_dispatch=next_dispatch(projects),
        active_projects=len(projects),
        health=health(session, user),
    )


@router.post("/tasks/{task_id}/done", status_code=204)
def tick(task_id: int, session: Session = Depends(get_session), today: date = Depends(get_today),
         user: User = Depends(display_user)):
    task_routes.mark_done(task_id=task_id, session=session, today=today, user=user)


@router.delete("/tasks/{task_id}/done", status_code=204)
def untick(task_id: int, session: Session = Depends(get_session), today: date = Depends(get_today),
           user: User = Depends(display_user)):
    task_routes.mark_not_done(task_id=task_id, session=session, today=today, user=user)


# --- What the screen says ----------------------------------------------------


def _late(days: int) -> str:
    return f"{days} day{'s' if days != 1 else ''} late"


def alert_for(p: DashboardProject, today: date) -> DisplayAlert | None:
    """One line saying why a flagged project needs looking at; the worst reason wins."""
    if p.flag == Flag.none:
        return None
    reasons: list[tuple[Flag, str]] = []
    for s in p.stages:
        if s.flag != Flag.none and s.due_date:
            days = (s.due_date - today).days
            reasons.append((s.flag, f"{s.name} {_late(-days)}" if days < 0 else f"{s.name} due in {days}d"))
    for pay in p.payments:
        if pay.flag != Flag.none:
            reasons.append((pay.flag, f"{pay.label} payment {'overdue' if pay.flag == Flag.red else 'due soon'}"))
    if p.dispatch_flag != Flag.none and p.days_to_dispatch is not None:
        d = p.days_to_dispatch
        reasons.append((p.dispatch_flag, f"Dispatch {_late(-d)}" if d < 0 else f"Dispatch in {d}d"))
    reasons.sort(key=lambda r: r[0] != Flag.red)  # red first, otherwise keep order
    reason = reasons[0][1] if reasons else "Needs attention"
    return DisplayAlert(project_id=p.id, project=p.name, flag=p.flag, reason=reason)


def next_dispatch(projects: list[DashboardProject]) -> DisplayDispatch | None:
    upcoming = [p for p in projects if p.dispatch_date and p.days_to_dispatch is not None and p.days_to_dispatch >= 0]
    if not upcoming:
        return None
    p = min(upcoming, key=lambda p: p.days_to_dispatch)
    return DisplayDispatch(project=p.name, date=p.dispatch_date, days=p.days_to_dispatch)


def health(session: Session, user: User) -> DisplayHealth:
    account = session.scalar(select(GoogleAccount).where(GoogleAccount.user_id == user.id))
    if account is None or not account.token_json:
        google, google_at = "off", None
    else:
        google, google_at = ("error" if account.last_error else "ok"), account.last_sync_at
    disk = shutil.disk_usage("/")
    return DisplayHealth(
        backup_at=latest_backup(),
        google=google,
        google_at=google_at,
        temp_c=cpu_temp(),
        disk_free_pct=round(disk.free * 100 / disk.total),
    )


def latest_backup() -> datetime | None:
    if not settings.backup_dir or not settings.backup_dir.is_dir():
        return None
    dumps = list(settings.backup_dir.glob("*.dump"))
    if not dumps:
        return None
    return datetime.fromtimestamp(max(d.stat().st_mtime for d in dumps), tz=timezone.utc)


def cpu_temp() -> float | None:
    # Containers can read the host's sysfs, so this is the Pi's own temperature
    try:
        return round(int(Path("/sys/class/thermal/thermal_zone0/temp").read_text()) / 1000, 1)
    except (OSError, ValueError):
        return None
