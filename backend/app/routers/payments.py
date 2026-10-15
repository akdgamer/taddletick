from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import auth, urgency
from app.auth import current_user
from app.db import get_session
from app.models import Payment, User
from app.routers.dashboard import get_today
from app.routers.projects import get_visible_project
from app.schemas import (
    ContactRead,
    OutstandingPayment,
    PaymentCreate,
    PaymentRead,
    PaymentUpdate,
    ProjectRef,
)

router = APIRouter(tags=["payments"])


def get_payment_or_404(session: Session, payment_id: int, user: User) -> Payment:
    """Only payments the user may see exist as far as they're concerned."""
    payment = session.get(Payment, payment_id)
    if payment is None or not auth.can_see(user, payment.project) or not auth.can_view_payments(user, payment.project):
        raise HTTPException(404, "Payment not found")
    return payment


@router.post("/projects/{project_id}/payments", response_model=PaymentRead, status_code=201)
def add_payment(
    project_id: int, body: PaymentCreate, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    auth.check(auth.can_edit_payments(user, get_visible_project(session, project_id, user)))
    payment = Payment(project_id=project_id, **body.model_dump())
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.patch("/payments/{payment_id}", response_model=PaymentRead)
def update_payment(
    payment_id: int, body: PaymentUpdate, session: Session = Depends(get_session), user: User = Depends(current_user)
):
    payment = get_payment_or_404(session, payment_id, user)
    auth.check(auth.can_edit_payments(user, payment.project))
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(payment, field, value)
    session.commit()
    session.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}", status_code=204)
def delete_payment(payment_id: int, session: Session = Depends(get_session), user: User = Depends(current_user)):
    payment = get_payment_or_404(session, payment_id, user)
    auth.check(auth.can_edit_payments(user, payment.project) and auth.can_delete(user, payment.project))
    session.delete(payment)
    session.commit()


@router.get("/payments/outstanding", response_model=list[OutstandingPayment])
def outstanding_payments(
    session: Session = Depends(get_session), today: date = Depends(get_today), user: User = Depends(current_user)
):
    """Every unpaid payment the user may see, including on completed projects, most urgent first."""
    payments = [
        p
        for p in session.scalars(select(Payment)).all()
        if not p.is_paid and auth.can_see(user, p.project) and auth.can_view_payments(user, p.project)
    ]
    payments.sort(key=lambda p: (urgency.payment_flag(p, today) != urgency.Flag.red, p.due_date is None, p.due_date or date.max))
    return [
        OutstandingPayment(
            **PaymentRead.model_validate(p).model_dump(),
            flag=urgency.payment_flag(p, today),
            project=ProjectRef.model_validate(p.project),
            client=p.project.client,
            # Who to call about it: the client's people
            contacts=[ContactRead.model_validate(c) for c in (p.project.client.contacts if p.project.client else [])],
        )
        for p in payments
    ]
