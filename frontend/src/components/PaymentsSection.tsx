import { useState, type FormEvent } from 'react'

import { useAddPayment, useDeletePayment, useUpdatePayment } from '../api/hooks'
import type { DashboardPayment, PaymentFields } from '../api/types'
import { formatDate, formatMoney, todayIso } from '../format'
import { CheckIcon, EditIcon, IconButton, TrashIcon } from './Icons'

const EMPTY: PaymentFields = {
  label: '',
  expected_amount: 0,
  due_date: null,
  received_amount: 0,
  received_date: null,
  notes: '',
}

interface Rights {
  canEdit: boolean // add, edit, mark received
  canDelete: boolean
}

export function PaymentsSection({
  projectId,
  payments,
  canEdit,
  canDelete,
}: { projectId: number; payments: DashboardPayment[] } & Rights) {
  const [adding, setAdding] = useState(false)
  const expected = payments.reduce((sum, p) => sum + p.expected_amount, 0)
  const received = payments.reduce((sum, p) => sum + p.received_amount, 0)
  const worst = payments.some((p) => p.flag === 'red') ? 'red' : payments.some((p) => p.flag === 'amber') ? 'amber' : 'none'

  return (
    <details className="tile-section">
      <summary>
        Payments
        {payments.length > 0 && (
          <span className={`section-summary flag-${worst}`}>
            {formatMoney(received)} of {formatMoney(expected)} received
          </span>
        )}
      </summary>
      {payments.length > 0 && (
        <ul className="payment-list">
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} canEdit={canEdit} canDelete={canDelete} />
          ))}
        </ul>
      )}
      {adding ? (
        <PaymentForm projectId={projectId} onDone={() => setAdding(false)} />
      ) : (
        canEdit && (
          <button className="link-button" onClick={() => setAdding(true)}>
            + Add payment
          </button>
        )
      )}
    </details>
  )
}

function PaymentRow({ payment, canEdit, canDelete }: { payment: DashboardPayment } & Rights) {
  const updatePayment = useUpdatePayment()
  const deletePayment = useDeletePayment()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li>
        <PaymentForm payment={payment} onDone={() => setEditing(false)} />
      </li>
    )
  }

  const status = payment.is_paid
    ? `Received${payment.received_date ? ` ${formatDate(payment.received_date)}` : ''}`
    : payment.received_amount > 0
      ? `${formatMoney(payment.received_amount)} received`
      : payment.due_date
        ? `Due ${formatDate(payment.due_date)}`
        : 'No due date'

  return (
    <li className={`payment flag-${payment.flag}${payment.is_paid ? ' paid' : ''}`}>
      <span className="payment-label">{payment.label}</span>
      <span className="payment-amount">{formatMoney(payment.expected_amount)}</span>
      <span className="payment-status">{status}</span>
      <span className="row-actions">
        {canEdit && !payment.is_paid && (
          <IconButton
            label="Mark received"
            tone="ok"
            icon={<CheckIcon />}
            onClick={() =>
              updatePayment.mutate({
                id: payment.id,
                body: {
                  received_amount: payment.expected_amount,
                  received_date: todayIso(),
                },
              })
            }
          />
        )}
        {canEdit && (
          <IconButton label="Edit payment" tone="accent" icon={<EditIcon />} onClick={() => setEditing(true)} />
        )}
        {canDelete && (
          <IconButton
            label={`Delete payment ${payment.label}`}
            tone="danger"
            icon={<TrashIcon />}
            onClick={() => deletePayment.mutate(payment.id)}
          />
        )}
      </span>
      {payment.notes && <span className="payment-notes muted">{payment.notes}</span>}
    </li>
  )
}

function PaymentForm({
  projectId,
  payment,
  onDone,
}: {
  projectId?: number
  payment?: DashboardPayment
  onDone: () => void
}) {
  const addPayment = useAddPayment()
  const updatePayment = useUpdatePayment()
  const mutation = payment ? updatePayment : addPayment
  const [f, setF] = useState<PaymentFields>(payment ?? EMPTY)
  const set = <K extends keyof PaymentFields>(key: K, value: PaymentFields[K]) => setF({ ...f, [key]: value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = { ...f, label: f.label.trim() }
    if (payment) updatePayment.mutate({ id: payment.id, body }, { onSuccess: onDone })
    else addPayment.mutate({ projectId: projectId!, body }, { onSuccess: onDone })
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid compact">
        <label>
          Milestone
          <input required placeholder="e.g. Advance 30%" value={f.label} onChange={(e) => set('label', e.target.value)} />
        </label>
        <label>
          Amount
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={f.expected_amount || ''}
            onChange={(e) => set('expected_amount', Number(e.target.value))}
          />
        </label>
        <label>
          Due date
          <input type="date" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
        </label>
        <label>
          Received so far
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.received_amount || ''}
            onChange={(e) => set('received_amount', Number(e.target.value))}
          />
        </label>
        <label>
          Received on
          <input type="date" value={f.received_date ?? ''} onChange={(e) => set('received_date', e.target.value || null)} />
        </label>
      </div>
      <label>
        Notes
        <input value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      {mutation.error && <p className="error">{mutation.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={mutation.isPending}>
          {payment ? 'Save' : 'Add payment'}
        </button>
      </div>
    </form>
  )
}
