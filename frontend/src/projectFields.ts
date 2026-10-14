import type { ProjectFields, ProjectLabel } from './api/types'

/** Form-friendly version of ProjectFields: empty strings instead of nulls. */
export interface FieldValues {
  name: string
  client_id: string // '' = no client; a select's value is always a string
  po_number: string
  label: ProjectLabel
  is_p0: boolean
  dispatch_date: string
  notes: string
}

export const EMPTY_FIELDS: FieldValues = {
  name: '',
  client_id: '',
  po_number: '',
  label: 'company',
  is_p0: false,
  dispatch_date: '',
  notes: '',
}

export function toFieldValues(p: ProjectFields): FieldValues {
  return {
    name: p.name,
    client_id: p.client_id === null ? '' : String(p.client_id),
    po_number: p.po_number ?? '',
    label: p.label,
    is_p0: p.is_p0,
    dispatch_date: p.dispatch_date ?? '',
    notes: p.notes,
  }
}

export function toProjectFields(v: FieldValues): ProjectFields {
  return {
    name: v.name.trim(),
    client_id: v.client_id ? Number(v.client_id) : null,
    po_number: v.po_number.trim() || null,
    label: v.label,
    is_p0: v.is_p0,
    dispatch_date: v.dispatch_date || null,
    notes: v.notes,
  }
}
