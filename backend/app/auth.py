"""Logins and permissions.

Passwords are hashed with scrypt (Python's standard library). After 5 wrong
passwords for a username within 15 minutes, that username can't log in until the
oldest of them is 15 minutes old. A login creates a
random session token: the browser keeps it in an HttpOnly cookie and the database
keeps only its SHA-256, so a leaked database can't be used to log in.

Who may do what:
- personal projects: only their owner sees or changes them (admins included)
- company projects: everyone sees them, unless restricted to some roles
  (admins always see restricted ones); changing them needs the role's flags
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.models import LoginFailure, Project, ProjectLabel, User, UserSession

COOKIE = "taddletick_session"
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}
MAX_FAILURES = 5
LOCKOUT = timedelta(minutes=15)


# --- Passwords --------------------------------------------------------------


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **_SCRYPT)
    return hmac.compare_digest(actual, bytes.fromhex(digest))


# --- Guessing protection ----------------------------------------------------
# Counted per username (also ones that don't exist, so the answer doesn't reveal which do).
# Not per IP: behind Tailscale's proxy every request comes from the same address.


def check_not_locked(session: Session, username: str) -> None:
    """429 while a username has too many recent wrong passwords, saying how long to wait."""
    since = datetime.now(timezone.utc) - LOCKOUT
    recent = session.scalars(
        select(LoginFailure.at)
        .where(LoginFailure.username == username.strip().lower(), LoginFailure.at > since)
        .order_by(LoginFailure.at.desc())
        .limit(MAX_FAILURES)
    ).all()
    if len(recent) < MAX_FAILURES:
        return
    # Unlocks when the oldest of the last five falls out of the window
    wait = recent[-1] + LOCKOUT - datetime.now(timezone.utc)
    minutes = max(1, -(-int(wait.total_seconds()) // 60))
    raise HTTPException(
        429,
        f"Too many wrong passwords. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(max(1, int(wait.total_seconds())))},
    )


def record_failure(session: Session, username: str) -> None:
    session.add(LoginFailure(username=username.strip().lower()[:100], at=datetime.now(timezone.utc)))
    # Old entries are useless; tidy up as we go
    session.execute(delete(LoginFailure).where(LoginFailure.at < datetime.now(timezone.utc) - timedelta(days=1)))
    session.commit()


def clear_failures(session: Session, username: str) -> None:
    session.execute(delete(LoginFailure).where(LoginFailure.username == username.strip().lower()))


# --- Sessions ---------------------------------------------------------------


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(session: Session, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    session.add(UserSession(token_hash=_token_hash(token), user_id=user.id, expires_at=expires))
    session.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,  # page scripts can't read it
        samesite="lax",  # not sent on cross-site POSTs, which blocks CSRF
        secure=settings.cookie_secure,
    )


def end_session(session: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        record = session.get(UserSession, _token_hash(token))
        if record:
            session.delete(record)
            session.commit()
    response.delete_cookie(COOKIE)


def end_all_sessions(session: Session, user_id: int) -> None:
    session.query(UserSession).filter(UserSession.user_id == user_id).delete()


def current_user(request: Request, session: Session = Depends(get_session)) -> User:
    """FastAPI dependency: the logged-in user, or 401."""
    token = request.cookies.get(COOKIE)
    record = session.get(UserSession, _token_hash(token)) if token else None
    if record is None or record.expires_at < datetime.now(timezone.utc) or not record.user.is_active:
        raise HTTPException(401, "Not logged in")
    return record.user


def require(permission: str):
    """Dependency factory for role flags, e.g. Depends(require("can_edit"))."""

    def check(user: User = Depends(current_user)) -> User:
        if not user.allowed(permission):
            raise HTTPException(403, "Your role doesn't allow this")
        return user

    return check


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.role.is_admin:
        raise HTTPException(403, "Only admins can do this")
    return user


# --- Project permissions -------------------------------------------------------


def _is_personal(project: Project) -> bool:
    return project.label == ProjectLabel.personal


def can_see(user: User, project: Project) -> bool:
    if _is_personal(project):
        return project.owner_id == user.id
    if user.role.is_admin or not project.allowed_roles:
        return True
    return user.role_id in project.allowed_role_ids


def _may(user: User, project: Project, permission: str) -> bool:
    if _is_personal(project):
        return project.owner_id == user.id  # your own personal project: you can do anything
    return can_see(user, project) and user.allowed(permission)


def can_edit(user: User, project: Project) -> bool:
    return _may(user, project, "can_edit")


def can_delete(user: User, project: Project) -> bool:
    return _may(user, project, "can_delete")


def can_view_payments(user: User, project: Project) -> bool:
    return _may(user, project, "can_view_payments")


def can_edit_payments(user: User, project: Project) -> bool:
    return _may(user, project, "can_edit_payments")


def access(user: User, project: Project) -> dict[str, bool]:
    """What the UI should offer on this project."""
    return {
        "can_edit": can_edit(user, project),
        "can_delete": can_delete(user, project),
        "can_view_payments": can_view_payments(user, project),
        "can_edit_payments": can_edit_payments(user, project),
    }


def check(allowed: bool, message: str = "Your role doesn't allow this") -> None:
    if not allowed:
        raise HTTPException(403, message)
