import { useState, type FormEvent } from 'react'

import { useCreateProject, useStageTypes } from '../api/hooks'
import type { ProjectLabel } from '../api/types'
import { StagePicker } from './StagePicker'

const EMPTY = {
  name: '',
  client_name: '',
  po_number: '',
  label: 'company' as ProjectLabel,
  is_p0: false,
  dispatch_date: '',
  notes: '',
}

export function NewProjectForm({ onDone }: { onDone: () => void }) {
  const createProject = useCreateProject()
  const { data: stageTypes = [] } = useStageTypes()
  const [fields, setFields] = useState(EMPTY)
  const [stageIds, setStageIds] = useState<number[]>([])

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setFields((f) => ({ ...f, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Stages go in catalog order, whatever order they were ticked in
    const orderedIds = stageTypes.map((t) => t.id).filter((id) => stageIds.includes(id))
    createProject.mutate(
      {
        name: fields.name.trim(),
        client_name: fields.client_name.trim() || null,
        po_number: fields.po_number.trim() || null,
        label: fields.label,
        is_p0: fields.is_p0,
        dispatch_date: fields.dispatch_date || null,
        notes: fields.notes,
        stage_type_ids: orderedIds,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="new-project" onSubmit={submit}>
      <h2>New project</h2>
      <div className="form-grid">
        <label>
          Name
          <input required value={fields.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Client
          <input value={fields.client_name} onChange={(e) => set('client_name', e.target.value)} />
        </label>
        <label>
          PO number
          <input value={fields.po_number} onChange={(e) => set('po_number', e.target.value)} />
        </label>
        <label>
          Dispatch date
          <input type="date" value={fields.dispatch_date} onChange={(e) => set('dispatch_date', e.target.value)} />
        </label>
        <label>
          Type
          <select value={fields.label} onChange={(e) => set('label', e.target.value as ProjectLabel)}>
            <option value="company">Company</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={fields.is_p0} onChange={(e) => set('is_p0', e.target.checked)} />
          P0
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={fields.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      <StagePicker selected={stageIds} onChange={setStageIds} />

      {createProject.error && <p className="error">{createProject.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={createProject.isPending}>
          Create project
        </button>
      </div>
    </form>
  )
}
