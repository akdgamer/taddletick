import type { ProjectLabel } from '../api/types'
import type { FieldValues } from '../projectFields'
import { ClientSelect } from './ClientSelect'

interface Props {
  values: FieldValues
  onChange: (values: FieldValues) => void
  /** Types this user may pick (e.g. a Viewer can only keep personal projects) */
  labels?: ProjectLabel[]
}

/** The project fields shared by the new-project form and a tile's edit mode. */
export function ProjectFieldsForm({ values, onChange, labels = ['company', 'personal'] }: Props) {
  const set = <K extends keyof FieldValues>(key: K, value: FieldValues[K]) => onChange({ ...values, [key]: value })

  return (
    <>
      <div className="form-grid">
        <label>
          Name
          <input required value={values.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="field">
          <span>Client</span>
          <ClientSelect value={values.client_id} onChange={(v) => set('client_id', v)} />
        </div>
        <label>
          PO number
          <input value={values.po_number} onChange={(e) => set('po_number', e.target.value)} />
        </label>
        <label>
          Dispatch date
          <input type="date" value={values.dispatch_date} onChange={(e) => set('dispatch_date', e.target.value)} />
        </label>
        <label>
          Type
          <select
            value={values.label}
            disabled={labels.length < 2}
            onChange={(e) => set('label', e.target.value as ProjectLabel)}
          >
            {/* Always offer the current value, even when it can't be picked any more */}
            {(labels.includes(values.label) ? labels : [values.label, ...labels]).map((l) => (
              <option key={l} value={l}>
                {l === 'company' ? 'Company' : 'Personal (only you see it)'}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={values.is_p0} onChange={(e) => set('is_p0', e.target.checked)} />
          P0
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </>
  )
}
