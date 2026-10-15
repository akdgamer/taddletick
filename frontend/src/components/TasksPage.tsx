import { useState, type FormEvent } from 'react'

import { useCreateTask, useDashboard, useDeleteTask, useTasks, useUpdateTask } from '../api/hooks'
import type { Recurrence, Task, TaskFields } from '../api/types'
import { formatDate, todayIso } from '../format'
import { ArchiveIcon, EditIcon, IconButton, TrashIcon } from './Icons'

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  none: 'One-off',
}

function describe(task: Task): string {
  if (task.recurrence === 'weekly') {
    const [y, m, d] = task.start_date.split('-').map(Number)
    return `Every ${new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long' })}`
  }
  if (task.recurrence === 'none') return `One-off from ${formatDate(task.start_date)}`
  return RECURRENCE_LABELS[task.recurrence]
}

export function TasksPage() {
  const { data: tasks = [], isPending } = useTasks()
  const [adding, setAdding] = useState(false)

  return (
    <main className="page narrow">
      <header className="page-header">
        <h1>Tasks</h1>
        {!adding && (
          <button className="primary" onClick={() => setAdding(true)}>
            New task
          </button>
        )}
      </header>
      <p className="muted">
        Tasks show up on the dashboard's Today list on the days they repeat. One-off tasks stay there until done.
      </p>
      {adding && (
        <section className="card">
          <TaskForm onDone={() => setAdding(false)} />
        </section>
      )}
      {isPending && <p className="muted">Loading…</p>}
      {!isPending && tasks.length === 0 && <p className="muted">No tasks yet.</p>}
      {tasks.length > 0 && (
        <ul className="contact-list card">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </ul>
      )}
    </main>
  )
}

function TaskItem({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li>
        <TaskForm task={task} onDone={() => setEditing(false)} />
      </li>
    )
  }
  return (
    <li className="contact-item">
      <div>
        <strong>{task.title}</strong>
        <div className="muted">
          {describe(task)}
          {task.project && ` · ${task.project.name}`}
        </div>
        {task.notes && <div className="muted">{task.notes}</div>}
      </div>
      <div className="row-actions">
        <IconButton label="Edit task" tone="accent" icon={<EditIcon />} onClick={() => setEditing(true)} />
        <IconButton
          label="Archive task"
          tone="warn"
          icon={<ArchiveIcon />}
          onClick={() => updateTask.mutate({ id: task.id, body: { is_archived: true } })}
        />
        <IconButton label="Delete task" tone="danger" icon={<TrashIcon />} onClick={() => deleteTask.mutate(task.id)} />
      </div>
    </li>
  )
}

function TaskForm({ task, onDone }: { task?: Task; onDone: () => void }) {
  const { data: projects = [] } = useDashboard()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const mutation = task ? updateTask : createTask
  const [f, setF] = useState<TaskFields>(
    task ?? { title: '', notes: '', project_id: null, recurrence: 'daily', start_date: todayIso() },
  )
  const set = <K extends keyof TaskFields>(key: K, value: TaskFields[K]) => setF({ ...f, [key]: value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = {
      title: f.title.trim(),
      notes: f.notes,
      project_id: f.project_id,
      recurrence: f.recurrence,
      start_date: f.start_date,
    }
    if (task) updateTask.mutate({ id: task.id, body }, { onSuccess: onDone })
    else createTask.mutate(body, { onSuccess: onDone })
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Task
          <input required value={f.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label>
          Repeats
          <select value={f.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {f.recurrence === 'weekly' ? 'First day (sets the weekday)' : f.recurrence === 'none' ? 'Show from' : 'Starting'}
          <input required type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </label>
        <label>
          Project
          <select
            value={f.project_id ?? ''}
            onChange={(e) => set('project_id', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
          {task ? 'Save' : 'Add task'}
        </button>
      </div>
    </form>
  )
}
