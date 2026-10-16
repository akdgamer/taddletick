import { useEffect, useState } from 'react'

import type { DashboardProject } from './api/types'

export type Show = 'all' | 'attention' | 'overdue' | 'p0'
export type Kind = 'all' | 'company' | 'personal'

export interface Filters {
  text: string
  show: Show
  kind: Kind
  clientId: number | null
}

export const NO_FILTERS: Filters = { text: '', show: 'all', kind: 'all', clientId: null }

export const SHOW_TESTS: Record<Show, (p: DashboardProject) => boolean> = {
  all: () => true,
  attention: (p) => p.flag !== 'none',
  overdue: (p) => p.flag === 'red',
  p0: (p) => p.is_p0,
}

/** Keeps the API's priority order; every typed word must match the name, client, PO or a stage. */
export function applyFilters(projects: DashboardProject[], f: Filters): DashboardProject[] {
  const words = f.text.toLowerCase().split(/\s+/).filter(Boolean)
  return projects.filter((p) => {
    if (!SHOW_TESTS[f.show](p)) return false
    if (f.kind !== 'all' && p.label !== f.kind) return false
    if (f.clientId !== null && p.client_id !== f.clientId) return false
    if (words.length) {
      const haystack = [p.name, p.client?.name, p.po_number, ...p.stages.map((s) => s.name)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!words.every((w) => haystack.includes(w))) return false
    }
    return true
  })
}

export const isFiltered = (f: Filters) =>
  f.text.trim() !== '' || f.show !== 'all' || f.kind !== 'all' || f.clientId !== null

const KEY = 'project-filters'

/** Filters survive a reload on this device (not the search text, which is usually a one-off). */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      return saved ? { ...NO_FILTERS, ...saved, text: '' } : NO_FILTERS
    } catch {
      return NO_FILTERS
    }
  })
  useEffect(() => {
    try {
      const { show, kind, clientId } = filters
      localStorage.setItem(KEY, JSON.stringify({ show, kind, clientId }))
    } catch {
      // Private mode or blocked storage: filters just won't be remembered
    }
  }, [filters])
  return [filters, setFilters] as const
}
