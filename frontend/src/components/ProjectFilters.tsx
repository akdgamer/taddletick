import type { DashboardProject } from '../api/types'
import { NO_FILTERS, SHOW_TESTS, isFiltered, type Filters, type Kind, type Show } from '../projectFilters'
import { SearchIcon } from './CommandPalette'
import { XIcon } from './Icons'

const SHOW_LABELS: Record<Show, string> = {
  all: 'All',
  attention: 'Needs attention',
  overdue: 'Overdue',
  p0: 'P0',
}

interface Props {
  projects: DashboardProject[]
  filters: Filters
  onChange: (filters: Filters) => void
  shown: number
}

/** Narrow the project list: text, urgency, company/personal, client. */
export function ProjectFilters({ projects, filters, onChange, shown }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const clients = [...new Map(projects.flatMap((p) => (p.client ? [[p.client.id, p.client]] : []))).values()].sort(
    (a, b) => a.name.localeCompare(b.name),
  )
  const hasPersonal = projects.some((p) => p.label === 'personal')
  const hasCompany = projects.some((p) => p.label === 'company')

  return (
    <div className="filter-bar" role="search" aria-label="Filter projects">
      <label className="filter-search">
        <SearchIcon />
        <input
          type="search"
          aria-label="Filter by name, client, PO or stage"
          placeholder="Filter projects"
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </label>

      <div className="chips" role="group" aria-label="Show">
        {(Object.keys(SHOW_LABELS) as Show[]).map((key) => {
          const count = key === 'all' ? null : projects.filter(SHOW_TESTS[key]).length
          return (
            <button
              key={key}
              className={`chip-toggle ${key === 'overdue' ? 'tone-red' : key === 'attention' ? 'tone-amber' : ''}`}
              aria-pressed={filters.show === key}
              onClick={() => set({ show: key })}
            >
              {SHOW_LABELS[key]}
              {count !== null && <span className="chip-count">{count}</span>}
            </button>
          )
        })}
      </div>

      {hasPersonal && hasCompany && (
        <select
          aria-label="Company or personal"
          className="filter-select"
          value={filters.kind}
          onChange={(e) => set({ kind: e.target.value as Kind })}
        >
          <option value="all">Company &amp; personal</option>
          <option value="company">Company only</option>
          <option value="personal">Personal only</option>
        </select>
      )}

      {clients.length > 1 && (
        <select
          aria-label="Client"
          className="filter-select"
          value={filters.clientId ?? ''}
          onChange={(e) => set({ clientId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {isFiltered(filters) && (
        <span className="filter-result">
          <span className="muted">
            {shown} of {projects.length}
          </span>
          <button className="text-button" onClick={() => onChange(NO_FILTERS)}>
            <XIcon />
            Clear
          </button>
        </span>
      )}
    </div>
  )
}
