"""One-way sync from this app to Google Calendar and Google Tasks.

The database is the source of truth. Each run works out what *should* exist in
Google (dispatch dates, unfinished stage due dates and unpaid payment due dates
as all-day events; today's open tasks as Google Tasks), then creates, updates or
deletes Google items to match. SyncedItem remembers which Google item mirrors
which local item, and a fingerprint of what was last sent, so unchanged items
cost no API calls. Edits made in Google's apps are overwritten on the next run.

The app owns one calendar and one task list, both named "Taddletick", and never
touches anything else in the account.
"""

import hashlib
import json
import os
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import task_schedule
from app.config import settings
from app.models import GoogleAccount, Payment, Project, StageStatus, SyncedItem, Task

SCOPES = [
    # Only calendars this app created, not the rest of the account's calendars
    "https://www.googleapis.com/auth/calendar.app.created",
    "https://www.googleapis.com/auth/tasks",
]
NAME = "Taddletick"
# All-day events start at midnight; 900 minutes before = 9:00 the day before
REMINDER_MINUTES = [900]

# Google may grant scopes in a different order/form than requested; don't treat that as an error
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


class NotConfigured(Exception):
    pass


# --- Account and OAuth ---------------------------------------------------


def is_configured() -> bool:
    return settings.google_client_secrets.is_file()


def get_account(session: Session) -> GoogleAccount:
    account = session.get(GoogleAccount, 1)
    if account is None:
        account = GoogleAccount(id=1)
        session.add(account)
        session.flush()
    return account


def _flow(**kwargs) -> Flow:
    if not is_configured():
        raise NotConfigured(f"Google client file not found at {settings.google_client_secrets}")
    return Flow.from_client_secrets_file(
        str(settings.google_client_secrets),
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        **kwargs,
    )


def start_auth(session: Session) -> str:
    """Returns the Google consent URL; remembers state and PKCE verifier for the callback."""
    flow = _flow(autogenerate_code_verifier=True)
    # offline + consent: always get a refresh token so the worker can sync unattended
    url, state = flow.authorization_url(access_type="offline", prompt="consent")
    account = get_account(session)
    account.oauth_state = state
    account.oauth_code_verifier = flow.code_verifier
    session.commit()
    return url


def finish_auth(session: Session, state: str, code: str) -> None:
    account = get_account(session)
    if not account.oauth_state or state != account.oauth_state:
        raise ValueError("Sign-in session expired or doesn't match; please try connecting again")
    flow = _flow(state=state, code_verifier=account.oauth_code_verifier)
    flow.fetch_token(code=code)
    account.token_json = flow.credentials.to_json()
    account.oauth_state = account.oauth_code_verifier = None
    account.last_error = None
    session.commit()


def disconnect(session: Session) -> None:
    account = get_account(session)
    account.token_json = None
    session.commit()


def _credentials(session: Session, account: GoogleAccount) -> Credentials:
    creds = Credentials.from_authorized_user_info(json.loads(account.token_json), SCOPES)
    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())
        account.token_json = creds.to_json()
        session.commit()
    return creds


# --- What should exist in Google ------------------------------------------


def _all_day(day: date) -> dict:
    return {"start": {"date": day.isoformat()}, "end": {"date": (day + timedelta(days=1)).isoformat()}}


def _event(summary: str, day: date, description: str) -> dict:
    return {
        "summary": summary,
        "description": description,
        **_all_day(day),
        "transparency": "transparent",  # don't block the day as busy
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": m} for m in REMINDER_MINUTES]},
    }


def _project_line(project: Project) -> str:
    parts = [project.client.name if project.client else None, project.po_number and f"PO {project.po_number}"]
    return " · ".join(p for p in parts if p)


def desired_events(session: Session) -> dict[str, dict]:
    events: dict[str, dict] = {}
    active = session.scalars(select(Project).where(Project.is_completed.is_(False))).unique().all()
    for project in active:
        line = _project_line(project)
        if project.dispatch_date:
            events[f"calendar:dispatch:{project.id}"] = _event(f"Dispatch: {project.name}", project.dispatch_date, line)
        for stage in project.stages:
            if stage.due_date and stage.status != StageStatus.done:
                events[f"calendar:stage:{stage.id}"] = _event(
                    f"{stage.name} due: {project.name}", stage.due_date, "\n".join(filter(None, [line, stage.notes]))
                )
    for payment in session.scalars(select(Payment)).all():
        if payment.due_date and not payment.is_paid:
            outstanding = float(payment.expected_amount) - float(payment.received_amount)
            events[f"calendar:payment:{payment.id}"] = _event(
                f"Payment due: {payment.project.name} ({payment.label})",
                payment.due_date,
                "\n".join(filter(None, [_project_line(payment.project), f"Outstanding: {outstanding:,.2f}", payment.notes])),
            )
    return events


def desired_tasks(session: Session, today: date) -> dict[str, dict]:
    tasks: dict[str, dict] = {}
    for task in session.scalars(select(Task)).unique().all():
        if not task_schedule.occurs_on(task, today) or task_schedule.is_done(task, today):
            continue
        # Recurring tasks get one Google task per day; one-offs keep a single one
        key = f"tasks:task:{task.id}" if task.recurrence.value == "none" else f"tasks:task:{task.id}:{today}"
        notes = "\n".join(filter(None, [task.project.name if task.project else None, task.notes]))
        tasks[key] = {"title": task.title, "notes": notes, "due": f"{today.isoformat()}T00:00:00.000Z"}
    return tasks


# --- Reconciling ----------------------------------------------------------


def _fingerprint(body: dict) -> str:
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def _is_gone(error: HttpError) -> bool:
    return error.resp.status in (404, 410)


def _reconcile(
    session: Session,
    prefix: str,
    desired: dict[str, dict],
    insert: Callable[[dict], str],
    update: Callable[[str, dict], None],
    delete: Callable[[str], None],
) -> dict[str, int]:
    counts = {"created": 0, "updated": 0, "deleted": 0}
    existing = {i.key: i for i in session.scalars(select(SyncedItem).where(SyncedItem.key.startswith(prefix)))}

    for key, body in desired.items():
        fp = _fingerprint(body)
        item = existing.get(key)
        if item is None:
            session.add(SyncedItem(key=key, google_id=insert(body), fingerprint=fp))
            counts["created"] += 1
        elif item.fingerprint != fp:
            try:
                update(item.google_id, body)
            except HttpError as e:
                if not _is_gone(e):
                    raise
                item.google_id = insert(body)  # deleted in Google: put it back
            item.fingerprint = fp
            counts["updated"] += 1
        session.commit()  # after each change, so a failure mid-run can't create duplicates

    for key in existing.keys() - desired.keys():
        try:
            delete(existing[key].google_id)
        except HttpError as e:
            if not _is_gone(e):
                raise
        session.delete(existing[key])
        session.commit()
        counts["deleted"] += 1
    return counts


def _forget(session: Session, prefix: str) -> None:
    for item in session.scalars(select(SyncedItem).where(SyncedItem.key.startswith(prefix))):
        session.delete(item)


def _ensure_calendar(session: Session, service, account: GoogleAccount) -> str:
    if account.calendar_id:
        try:
            service.calendars().get(calendarId=account.calendar_id).execute()
            return account.calendar_id
        except HttpError as e:
            if not _is_gone(e):
                raise
            _forget(session, "calendar:")  # calendar was deleted: start over
    account.calendar_id = service.calendars().insert(body={"summary": NAME}).execute()["id"]
    session.commit()
    return account.calendar_id


def _ensure_tasklist(session: Session, service, account: GoogleAccount) -> str:
    if account.tasklist_id:
        try:
            service.tasklists().get(tasklist=account.tasklist_id).execute()
            return account.tasklist_id
        except HttpError as e:
            if not _is_gone(e):
                raise
            _forget(session, "tasks:")
    account.tasklist_id = service.tasklists().insert(body={"title": NAME}).execute()["id"]
    session.commit()
    return account.tasklist_id


def sync_once(session: Session, today: date | None = None) -> dict:
    """Run one sync. Returns counts per side; records the outcome on the account row."""
    today = today or date.today()
    account = get_account(session)
    if not account.token_json:
        return {"skipped": "Google is not connected"}
    try:
        creds = _credentials(session, account)
        calendar = build("calendar", "v3", credentials=creds, cache_discovery=False)
        tasks = build("tasks", "v1", credentials=creds, cache_discovery=False)

        calendar_id = _ensure_calendar(session, calendar, account)
        events = calendar.events()
        calendar_counts = _reconcile(
            session,
            "calendar:",
            desired_events(session),
            insert=lambda body: events.insert(calendarId=calendar_id, body=body).execute()["id"],
            update=lambda gid, body: events.update(calendarId=calendar_id, eventId=gid, body=body).execute(),
            delete=lambda gid: events.delete(calendarId=calendar_id, eventId=gid).execute(),
        )

        tasklist_id = _ensure_tasklist(session, tasks, account)
        items = tasks.tasks()
        task_counts = _reconcile(
            session,
            "tasks:",
            desired_tasks(session, today),
            insert=lambda body: items.insert(tasklist=tasklist_id, body=body).execute()["id"],
            update=lambda gid, body: items.patch(tasklist=tasklist_id, task=gid, body=body).execute(),
            delete=lambda gid: items.delete(tasklist=tasklist_id, task=gid).execute(),
        )
    except Exception as e:
        session.rollback()
        account = get_account(session)
        account.last_error = f"{type(e).__name__}: {e}"[:2000]
        session.commit()
        raise

    account.last_sync_at = datetime.now(timezone.utc)
    account.last_error = None
    session.commit()
    return {"calendar": calendar_counts, "tasks": task_counts}

