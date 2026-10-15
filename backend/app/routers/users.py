from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import auth
from app.auth import current_user, require_admin
from app.db import get_session
from app.models import Role, User
from app.routers.auth import find_user
from app.schemas import RoleCreate, RoleRead, RoleUpdate, UserCreate, UserRead, UserUpdate

router = APIRouter(tags=["users"])


def get_or_404(session: Session, model, id: int, label: str):
    obj = session.get(model, id)
    if obj is None:
        raise HTTPException(404, f"{label} not found")
    return obj


def check_an_admin_remains(session: Session) -> None:
    """Call after a change is flushed: refuse it if nobody active could manage users any more."""
    admins = session.scalar(
        select(func.count(User.id)).join(Role).where(User.is_active.is_(True), Role.is_admin.is_(True))
    )
    if not admins:
        session.rollback()
        raise HTTPException(409, "There must always be at least one active admin")


# --- Users (admins only) --------------------------------------------------------


@router.get("/users", response_model=list[UserRead], dependencies=[Depends(require_admin)])
def list_users(session: Session = Depends(get_session)):
    return session.scalars(select(User).order_by(User.is_active.desc(), func.lower(User.display_name))).all()


@router.post("/users", response_model=UserRead, status_code=201, dependencies=[Depends(require_admin)])
def create_user(body: UserCreate, session: Session = Depends(get_session)):
    if find_user(session, body.username):
        raise HTTPException(409, f"Username '{body.username}' is taken")
    get_or_404(session, Role, body.role_id, "Role")
    user = User(
        username=body.username.strip(),
        display_name=body.display_name.strip(),
        password_hash=auth.hash_password(body.password),
        role_id=body.role_id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int, body: UserUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)
):
    user = get_or_404(session, User, user_id, "User")
    changes = body.model_dump(exclude_unset=True)
    if user.id == admin.id and (changes.get("is_active") is False or "role_id" in changes and changes["role_id"] != user.role_id):
        raise HTTPException(409, "You can't change your own role or deactivate yourself")
    if "role_id" in changes:
        get_or_404(session, Role, changes["role_id"], "Role")
    if password := changes.pop("password", None):
        user.password_hash = auth.hash_password(password)
        auth.end_all_sessions(session, user.id)
    for field, value in changes.items():
        setattr(user, field, value)
    if changes.get("is_active") is False:
        auth.end_all_sessions(session, user.id)  # log them out everywhere
    session.flush()
    check_an_admin_remains(session)
    session.commit()
    session.refresh(user)
    return user


# --- Roles (everyone can list them; admins change them) ----------------------------


@router.get("/roles", response_model=list[RoleRead], dependencies=[Depends(current_user)])
def list_roles(session: Session = Depends(get_session)):
    return session.scalars(select(Role).order_by(Role.id)).all()


def check_role_name_free(session: Session, name: str, exclude_id: int | None = None) -> None:
    query = select(Role.id).where(func.lower(Role.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Role.id != exclude_id)
    if session.scalar(query):
        raise HTTPException(409, f"Role '{name}' already exists")


@router.post("/roles", response_model=RoleRead, status_code=201, dependencies=[Depends(require_admin)])
def create_role(body: RoleCreate, session: Session = Depends(get_session)):
    name = body.name.strip()
    check_role_name_free(session, name)
    role = Role(**body.model_dump() | {"name": name})
    session.add(role)
    session.commit()
    return role


@router.patch("/roles/{role_id}", response_model=RoleRead, dependencies=[Depends(require_admin)])
def update_role(role_id: int, body: RoleUpdate, session: Session = Depends(get_session)):
    role = get_or_404(session, Role, role_id, "Role")
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        check_role_name_free(session, changes["name"], exclude_id=role_id)
    for field, value in changes.items():
        setattr(role, field, value)
    session.flush()
    check_an_admin_remains(session)
    session.commit()
    return role


@router.delete("/roles/{role_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_role(role_id: int, session: Session = Depends(get_session)):
    role = get_or_404(session, Role, role_id, "Role")
    in_use = session.scalar(select(func.count(User.id)).where(User.role_id == role_id))
    if in_use:
        raise HTTPException(409, f"{in_use} user(s) still have the role '{role.name}'; give them another role first")
    session.delete(role)  # projects restricted to it lose that restriction (link rows cascade)
    session.commit()
