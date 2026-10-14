import type { ProjectLabel } from '../api/types'
import type { FieldValues } from '../projectFields'

interface Props {
  values: FieldValues
  onChange: (values: FieldValues) => void
}

/** The project fields shared by the new-project form and a tile's edit mode. */
export function ProjectFieldsForm({ values, onChange }: Props) {
  const set = <K extends keyof FieldValues>(key: K, value: FieldValues[K]) => onChange({ ...values, [key]: value })

  return (
    <>
      <div className="form-grid">
        <label>
          Name
          <input required value={values.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Client
          <input value={values.client_name} onChange={(e) => set('client_name', e.target.value)} />
        </label>
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
          <select value={values.label} onChange={(e) => set('label', e.target.value as ProjectLabel)}>
            <option value="company">Company</option>
            <option value="personal">Personal</option>
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
