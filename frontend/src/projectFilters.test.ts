import { describe, expect, it } from 'vitest'

import type { DashboardProject } from './api/types'
import { applyFilters, NO_FILTERS } from './projectFilters'

const project = (fields: Partial<DashboardProject>) => ({ ...BASE, ...fields }) as DashboardProject
const BASE = {
  name: 'x',
  client: null,
  client_id: null,
  po_number: null,
  label: 'company',
  is_p0: false,
  flag: 'none',
  stages: [],
}

const PROJECTS = [
  project({ id: 1, name: 'Welding fixture', client: { id: 3, name: 'Acme' }, client_id: 3, flag: 'red', is_p0: true }),
  project({
    id: 2,
    name: 'Label applicator',
    po_number: '7781',
    flag: 'amber',
    stages: [{ name: 'Electrical design' } as DashboardProject['stages'][0]],
  }),
  project({ id: 3, name: 'Garage shelves', label: 'personal' }),
]
const ids = (f: Partial<typeof NO_FILTERS>) => applyFilters(PROJECTS, { ...NO_FILTERS, ...f }).map((p) => p.id)

describe('applyFilters', () => {
  it('keeps everything, in order, with no filters', () => {
    expect(ids({})).toEqual([1, 2, 3])
  })

  it('matches every word against name, client, PO and stages', () => {
    expect(ids({ text: 'acme' })).toEqual([1])
    expect(ids({ text: '7781' })).toEqual([2])
    expect(ids({ text: 'electrical label' })).toEqual([2])
    expect(ids({ text: 'electrical acme' })).toEqual([])
  })

  it('filters by urgency, kind and client', () => {
    expect(ids({ show: 'attention' })).toEqual([1, 2])
    expect(ids({ show: 'overdue' })).toEqual([1])
    expect(ids({ show: 'p0' })).toEqual([1])
    expect(ids({ kind: 'personal' })).toEqual([3])
    expect(ids({ clientId: 3, show: 'attention' })).toEqual([1])
  })
})
