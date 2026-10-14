from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import urgency
from app.db import get_session
from app.models import Payment
from app.routers.dashboard import get_today
from app.routers.projects import get_project_or_404
from app.schemas import (
    ContactRead,
    OutstandingPayment,
    PaymentCreate,
    PaymentRead,
    PaymentUpdate,
    ProjectRef,
)

router = APIRouter(tags=["payments"])


def get_payment_or_404(session: Session, payment_id: int) -> Payment:
    payment = session.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(404, "Payment not found")
    return payment


@router.post("/projects/{project_id}/payments", response_model=PaymentRead, status_code=201)
def add_payment(project_id: int, body: PaymentCreate, session: Session = Depends(get_session)):
    get_project_or_404(session, project_id)
    payment = Payment(project_id=project_id, **body.model_dump())
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.patch("/payments/{payment_id}", response_model=PaymentRead)
def update_payment(payment_id: int, body: PaymentUpdate, session: Session = Depends(get_session)):
    payment = get_payment_or_404(session, payment_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(payment, field, value)
    session.commit()
    session.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}", status_code=204)
def delete_payment(payment_id: int, session: Session = Depends(get_session)):
    session.delete(get_payment_or_404(session, payment_id))
    session.commit()


@router.get("/payments/outstanding", response_model=list[OutstandingPayment])
def outstanding_payments(session: Session = Depends(get_session), today: date = Depends(get_today)):
    """Every unpaid payment, including on completed projects, most urgent first."""
    payments = [p for p in session.scalars(select(Payment)).all() if not p.is_paid]
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
