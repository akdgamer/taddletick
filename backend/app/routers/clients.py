from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require
from app.db import get_session
from app.models import Client, Contact, Project
from app.schemas import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


def get_client_or_404(session: Session, client_id: int) -> Client:
    client = session.get(Client, client_id)
    if client is None:
        raise HTTPException(404, "Client not found")
    return client


def check_client_exists(session: Session, client_id: int | None) -> None:
    """For other routers: a client_id in a request body must point at a real client."""
    if client_id is not None and session.get(Client, client_id) is None:
        raise HTTPException(422, f"Unknown client id: {client_id}")


def check_name_free(session: Session, name: str, exclude_id: int | None = None) -> None:
    query = select(Client.id).where(func.lower(Client.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    if session.scalar(query) is not None:
        raise HTTPException(409, f"Client '{name}' already exists")


@router.get("", response_model=list[ClientRead])
def list_clients(session: Session = Depends(get_session)):
    return session.scalars(select(Client).order_by(func.lower(Client.name))).unique().all()


@router.get("/{client_id}", response_model=ClientRead)
def get_client(client_id: int, session: Session = Depends(get_session)):
    return get_client_or_404(session, client_id)


@router.post("", response_model=ClientRead, status_code=201, dependencies=[Depends(require("can_edit"))])
def create_client(body: ClientCreate, session: Session = Depends(get_session)):
    name = body.name.strip()
    check_name_free(session, name)
    client = Client(**body.model_dump() | {"name": name})
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.patch("/{client_id}", response_model=ClientRead, dependencies=[Depends(require("can_edit"))])
def update_client(client_id: int, body: ClientUpdate, session: Session = Depends(get_session)):
    client = get_client_or_404(session, client_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        check_name_free(session, changes["name"], exclude_id=client_id)
    for field, value in changes.items():
        setattr(client, field, value)
    session.commit()
    session.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204, dependencies=[Depends(require("can_delete"))])
def delete_client(client_id: int, session: Session = Depends(get_session)):
    client = get_client_or_404(session, client_id)
    # Refuse rather than silently unlinking projects or deleting people
    projects = session.scalar(select(func.count()).where(Project.client_id == client_id))
    contacts = session.scalar(select(func.count()).where(Contact.client_id == client_id))
    if projects or contacts:
        raise HTTPException(
            409,
            f"'{client.name}' still has {projects} project(s) and {contacts} contact(s); "
            "move or delete them first",
        )
    session.delete(client)
    session.commit()
