import { useState } from 'react'

import { useCreateTask, useOutstandingPayments, useSetTaskDone, useTodayTasks } from '../api/hooks'
import { formatDate, formatMoney } from '../format'

/** Today's checklist: recurring tasks plus one-offs carried over until done. */
export function TodayPanel() {
  const { data: tasks = [] } = useTodayTasks()
  const setDone = useSetTaskDone()
  const createTask = useCreateTask()
  const [title, setTitle] = useState('')
  const open = tasks.filter((t) => !t.done).length

  const quickAdd = () => {
    if (!title.trim()) return
    // Quick add from the dashboard = a one-off for today
    createTask.mutate({ title: title.trim(), recurrence: 'none' }, { onSuccess: () => setTitle('') })
  }

  return (
    <section className="panel" aria-label="Today">
      <h2>
        Today <span className="muted">{tasks.length ? `${open} open` : ''}</span>
      </h2>
      {tasks.length === 0 && <p className="muted">Nothing on today's list.</p>}
      <ul className="today-list">
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <label className="checkbox">
              <input type="checkbox" checked={t.done} onChange={() => setDone.mutate({ id: t.id, done: !t.done })} />
              <span>
                {t.title}
                {t.project && <span className="muted"> · {t.project.name}</span>}
                {t.days_overdue > 0 && <span className="overdue"> · {t.days_overdue}d overdue</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="inline-add">
        <input
          aria-label="Quick add task"
          placeholder="Add a one-off task for today"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
        />
        <button onClick={quickAdd} disabled={!title.trim()}>
          Add
        </button>
      </div>
    </section>
  )
}

/** Overdue and soon-due payments across all projects, with who to call. */
export function ChasePanel() {
  const { data: payments = [] } = useOutstandingPayments()
  const urgent = payments.filter((p) => p.flag !== 'none')
  const later = payments.length - urgent.length

  return (
    <section className="panel" aria-label="Payments to chase">
      <h2>Payments to chase</h2>
      {urgent.length === 0 && <p className="muted">Nothing overdue or due this week.</p>}
      <ul className="chase-list">
        {urgent.map((p) => {
          const outstanding = p.expected_amount - p.received_amount
          const contact = p.contacts.find((c) => c.phone || c.email)
          return (
            <li key={p.id} className={`flag-${p.flag}`}>
              <div>
                <strong>{formatMoney(outstanding)}</strong> · {p.project.name}
                {p.client && <span className="muted"> ({p.client.name})</span>}
              </div>
              <div className="muted">
                {p.label} · {p.flag === 'red' ? 'overdue since' : 'due'} {p.due_date && formatDate(p.due_date)}
                {p.project.is_completed && ' · project completed'}
              </div>
              {contact && (
                <div className="contact-links">
                  {contact.name}
                  {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>}
                  {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {later > 0 && <p className="muted">{later} more outstanding later.</p>}
    </section>
  )
}
