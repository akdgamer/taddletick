from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import require
from app.db import get_session
from app.models import Client, Contact
from app.routers.clients import check_client_exists
from app.schemas import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


def get_contact_or_404(session: Session, contact_id: int) -> Contact:
    contact = session.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(404, "Contact not found")
    return contact


@router.get("", response_model=list[ContactRead])
def list_contacts(q: str | None = None, session: Session = Depends(get_session)):
    """All contacts, or those matching every word of q in their name, role or company."""
    query = select(Contact).outerjoin(Client).order_by(func.lower(Contact.name))
    for word in (q or "").split():
        pattern = f"%{word}%"
        query = query.where(
            or_(Contact.name.ilike(pattern), Contact.role.ilike(pattern), Client.name.ilike(pattern))
        )
    return session.scalars(query).unique().all()


@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(contact_id: int, session: Session = Depends(get_session)):
    return get_contact_or_404(session, contact_id)


@router.post("", response_model=ContactRead, status_code=201, dependencies=[Depends(require("can_edit"))])
def create_contact(body: ContactCreate, session: Session = Depends(get_session)):
    check_client_exists(session, body.client_id)
    contact = Contact(**body.model_dump() | {"name": body.name.strip()})
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactRead, dependencies=[Depends(require("can_edit"))])
def update_contact(contact_id: int, body: ContactUpdate, session: Session = Depends(get_session)):
    contact = get_contact_or_404(session, contact_id)
    changes = body.model_dump(exclude_unset=True)
    if "client_id" in changes:
        check_client_exists(session, changes["client_id"])
    for field, value in changes.items():
        setattr(contact, field, value)
    session.commit()
    session.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204, dependencies=[Depends(require("can_delete"))])
def delete_contact(contact_id: int, session: Session = Depends(get_session)):
    # Their stage links go too (ON DELETE CASCADE on the link table)
    session.delete(get_contact_or_404(session, contact_id))
    session.commit()
