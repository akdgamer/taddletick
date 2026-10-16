from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app import auth
from app.auth import current_user
from app.db import get_session
from app.models import GoogleAccount, Project, Role, SyncedItem, Task, User
from app.schemas import LoginBody, PasswordChange, SetupBody, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

# Compared against when the username doesn't exist, so both cases take as long
_DUMMY_HASH = auth.hash_password("not-a-real-password")


class SetupStatus(BaseModel):
    needed: bool


def find_user(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(func.lower(User.username) == username.strip().lower()))


@router.get("/setup", response_model=SetupStatus)
def setup_status(session: Session = Depends(get_session)):
    """True until the first account exists (the app then shows the create-admin screen)."""
    return SetupStatus(needed=session.scalar(select(func.count(User.id))) == 0)


@router.post("/setup", response_model=UserRead, status_code=201)
def setup(body: SetupBody, response: Response, session: Session = Depends(get_session)):
    """Create the first admin. They take over everything made before there were users."""
    if session.scalar(select(func.count(User.id))):
        raise HTTPException(409, "Setup is already done; log in instead")
    admin_role = session.scalar(select(Role).where(Role.is_admin.is_(True)).order_by(Role.id))
    if admin_role is None:
        admin_role = Role(name="Admin", is_admin=True, can_edit=True, can_delete=True,
                          can_view_payments=True, can_edit_payments=True)
    user = User(
        username=body.username.strip(),
        display_name=body.display_name.strip(),
        password_hash=auth.hash_password(body.password),
        role=admin_role,
    )
    session.add(user)
    session.flush()
    for model, column in ((Project, Project.owner_id), (Task, Task.user_id),
                          (GoogleAccount, GoogleAccount.user_id), (SyncedItem, SyncedItem.user_id)):
        session.execute(update(model).where(column.is_(None)).values({column.key: user.id}))
    session.commit()
    auth.start_session(session, response, user)
    return user


@router.post("/login", response_model=UserRead)
def login(body: LoginBody, response: Response, session: Session = Depends(get_session)):
    # Checked before the password, so a right guess during a lockout doesn't get through either
    auth.check_not_locked(session, body.username)
    user = find_user(session, body.username)
    password_ok = auth.check_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not password_ok or not user.is_active:
        if not password_ok:
            auth.record_failure(session, body.username)
        raise HTTPException(401, "Wrong username or password")
    auth.clear_failures(session, body.username)
    auth.start_session(session, response, user)
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    auth.end_session(session, request, response)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)):
    return user


@router.post("/password", status_code=204)
def change_password(
    body: PasswordChange,
    response: Response,
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
):
    # Same limit, so a borrowed logged-in browser can't be used to guess the password
    auth.check_not_locked(session, user.username)
    if not auth.check_password(body.current_password, user.password_hash):
        auth.record_failure(session, user.username)
        raise HTTPException(400, "Current password is wrong")
    auth.clear_failures(session, user.username)
    user.password_hash = auth.hash_password(body.new_password)
    # Log out every other browser, keep this one logged in with a fresh session
    auth.end_all_sessions(session, user.id)
    session.commit()
    auth.start_session(session, response, user)
