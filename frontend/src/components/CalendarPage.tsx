import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useDashboard, useOutstandingPayments } from '../api/hooks'
import type { Flag } from '../api/types'
import { sendCommand } from '../commands'
import { todayIso } from '../format'
import { ChevronIcon } from './Menu'
import { SkeletonRows } from './Placeholders'

type Kind = 'dispatch' | 'stage' | 'payment'

interface CalEvent {
  key: string
  date: string // ISO yyyy-mm-dd
  kind: Kind
  title: string
  project: string
  projectId: number
  flag: Flag
  done: boolean
  completedProject: boolean
}

const KIND_LABELS: Record<Kind, string> = { dispatch: 'Dispatch', stage: 'Stages', payment: 'Payments' }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Heights used to work out what fits in a day cell (measured; must match index.css)
const DATE_ROW = 39 // cell padding, the date number and the gap after it
const CHIP = 42 // two-line entry incl. gap
const CHIP_COMPACT = 19 // one-line entry incl. gap
const MORE = 17 // "+N more"

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Every dated thing on the projects you can see, laid out by month. */
export function CalendarPage({ onOpenProject }: { onOpenProject: () => void }) {
  const events = useEvents()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [shown, setShown] = useState<Record<Kind, boolean>>({ dispatch: true, stage: true, payment: true })
  const [selected, setSelected] = useState<string | null>(null)
  const today = todayIso()
  const days = monthGrid(month)
  const weeks = days.length / 7
  const [gridRef, space] = useCellSpace(weeks)

  const step = (by: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1))
    setSelected(null)
  }

  // ← / → change month (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events.data) {
      if (!shown[e.kind]) continue
      map.set(e.date, [...(map.get(e.date) ?? []), e])
    }
    // Worst first within a day, finished last
    const rank = (e: CalEvent) => (e.done ? 3 : e.flag === 'red' ? 0 : e.flag === 'amber' ? 1 : 2)
    for (const list of map.values()) list.sort((a, b) => rank(a) - rank(b))
    return map
  }, [events.data, shown])

  const inMonth = (d: Date) => d.getMonth() === month.getMonth()
  const monthEvents = days.filter(inMonth).flatMap((d) => (byDate.get(iso(d)) ?? []).map((e) => e))
  const counts = {
    red: monthEvents.filter((e) => !e.done && e.flag === 'red').length,
    total: monthEvents.filter((e) => !e.done).length,
  }

  const open = (e: CalEvent) => {
    if (e.completedProject) return // it isn't on the active board
    onOpenProject()
    sendCommand({ type: 'show-project', id: e.projectId })
  }

  return (
    <main className="page calendar-page">
      <header className="page-header">
        <div>
          <h1>
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h1>
          <p className="page-summary">
            {counts.total === 0 ? 'Nothing due this month' : `${counts.total} due this month`}
            {counts.red > 0 && <span className="summary-red"> · {counts.red} overdue</span>}
          </p>
        </div>
        <div className="header-actions">
          <div className="chips" role="group" aria-label="Show">
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <button
                key={k}
                className={`chip-toggle cal-kind-${k}`}
                aria-pressed={shown[k]}
                onClick={() => setShown({ ...shown, [k]: !shown[k] })}
              >
                <span className="cal-swatch" aria-hidden />
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="cal-nav">
            <button className="icon-button" aria-label="Previous month" onClick={() => step(-1)}>
              <span className="flip">
                <ChevronIcon open={false} />
              </span>
            </button>
            <button
              onClick={() => {
                const now = new Date()
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                setSelected(today)
              }}
            >
              Today
            </button>
            <button className="icon-button" aria-label="Next month" onClick={() => step(1)}>
              <ChevronIcon open={false} />
            </button>
          </div>
        </div>
      </header>

      {events.isPending ? (
        <SkeletonRows count={4} />
      ) : (
        <>
          {/* Desktop: month grid */}
          <div
            ref={gridRef}
            className="cal-grid"
            role="grid"
            aria-label="Month"
            style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(0, 1fr))` }}
          >
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-weekday" role="columnheader">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const key = iso(d)
              const list = byDate.get(key) ?? []
              // Full two-line entries if they all fit; a crowded day switches to one-line entries,
              // keeping a line for "+N more" only when even those don't all fit
              const compact = list.length * CHIP > space
              const max =
                !compact || list.length * CHIP_COMPACT <= space
                  ? list.length
                  : Math.max(1, Math.floor((space - MORE) / CHIP_COMPACT))
              const extra = list.length - max
              return (
                <div
                  key={key}
                  role="gridcell"
                  className={[
                    'cal-day',
                    inMonth(d) ? '' : 'other-month',
                    key === today ? 'today' : '',
                    key === selected ? 'selected' : '',
                    d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : '',
                    compact ? 'compact' : '',
                  ].join(' ')}
                  onClick={() => setSelected(key === selected ? null : key)}
                >
                  <span className="cal-date">{d.getDate()}</span>
                  {list.slice(0, max).map((e) => (
                    <EventChip key={e.key} event={e} onOpen={open} />
                  ))}
                  {extra > 0 && <span className="cal-more">+{extra} more</span>}
                </div>
              )
            })}
            {selected && (
              <DayPanel date={selected} events={byDate.get(selected) ?? []} onOpen={open} onClose={() => setSelected(null)} />
            )}
          </div>


          {/* Phone: the month as a list */}
          <div className="cal-agenda">
            {days.filter(inMonth).filter((d) => byDate.has(iso(d))).length === 0 && (
              <p className="muted">Nothing due this month.</p>
            )}
            {days
              .filter((d) => inMonth(d) && byDate.has(iso(d)))
              .map((d) => (
                <section key={iso(d)} className={`card cal-agenda-day ${iso(d) === today ? 'today' : ''}`}>
                  <h2>{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</h2>
                  {(byDate.get(iso(d)) ?? []).map((e) => (
                    <EventRow key={e.key} event={e} onOpen={open} />
                  ))}
                </section>
              ))}
          </div>
        </>
      )}
    </main>
  )
}

function EventChip({ event: e, onOpen }: { event: CalEvent; onOpen: (e: CalEvent) => void }) {
  return (
    <button
      className={`cal-event kind-${e.kind} flag-${e.flag} ${e.done ? 'done' : ''}`}
      title={`${e.project} · ${e.title}${e.done ? ' (done)' : ''}`}
      onClick={(ev) => {
        ev.stopPropagation()
        onOpen(e)
      }}
    >
      <span className="cal-event-project">{e.project}</span>
      <span className="cal-event-title">{e.title}</span>
    </button>
  )
}

function EventRow({ event: e, onOpen }: { event: CalEvent; onOpen: (e: CalEvent) => void }) {
  return (
    <button className={`cal-row kind-${e.kind} flag-${e.flag} ${e.done ? 'done' : ''}`} onClick={() => onOpen(e)}>
      <span className="cal-swatch" aria-hidden />
      <span className="cal-row-text">
        <strong>{e.project}</strong>
        <span>
          {e.title}
          {e.done && ' · done'}
          {e.completedProject && ' · completed project'}
        </span>
      </span>
    </button>
  )
}

function DayPanel({ date, events, onOpen, onClose }: {
  date: string
  events: CalEvent[]
  onOpen: (e: CalEvent) => void
  onClose: () => void
}) {
  const [y, m, d] = date.split('-').map(Number)
  return (
    <section className="card cal-panel" aria-label="Selected day">
      <header>
        <h2>{new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      </header>
      {events.length === 0 ? (
        <p className="muted">Nothing due.</p>
      ) : (
        events.map((e) => <EventRow key={e.key} event={e} onOpen={onOpen} />)
      )}
    </section>
  )
}

/** Height available for entries in each day cell at the current window size (re-measured on resize). */
function useCellSpace(weeks: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState(130)

  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return
    const measure = () => {
      const header = grid.querySelector<HTMLElement>('.cal-weekday')?.offsetHeight ?? 30
      const cell = (grid.clientHeight - header) / weeks - 1
      setSpace(Math.max(0, Math.floor(cell - DATE_ROW)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [weeks])

  return [ref, space] as const
}

/** Monday-first weeks covering the whole month (5 or 6 rows) */
function monthGrid(first: Date): Date[] {
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const days: Date[] = []
  for (let d = new Date(start); d <= last || days.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return days
}

/** Dispatch dates, stage due dates and unpaid payments, from data the dashboard already loads */
function useEvents() {
  const dashboard = useDashboard()
  const outstanding = useOutstandingPayments()
  const data = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = []
    for (const p of dashboard.data ?? []) {
      const base = { project: p.name, projectId: p.id, completedProject: false }
      if (p.dispatch_date) {
        out.push({ ...base, key: `d${p.id}`, date: p.dispatch_date, kind: 'dispatch', title: 'Dispatch', flag: p.dispatch_flag, done: false })
      }
      for (const s of p.stages) {
        if (s.due_date) {
          out.push({ ...base, key: `s${s.id}`, date: s.due_date, kind: 'stage', title: s.name, flag: s.flag, done: s.status === 'done' })
        }
      }
      for (const pay of p.payments) {
        if (pay.due_date && !pay.is_paid) {
          out.push({ ...base, key: `p${pay.id}`, date: pay.due_date, kind: 'payment', title: `${pay.label} payment`, flag: pay.flag, done: false })
        }
      }
    }
    // Unpaid money on finished projects still needs chasing
    for (const pay of outstanding.data ?? []) {
      if (pay.project.is_completed && pay.due_date) {
        out.push({
          key: `p${pay.id}`, date: pay.due_date, kind: 'payment', title: `${pay.label} payment`, flag: pay.flag,
          done: false, project: pay.project.name, projectId: pay.project.id, completedProject: true,
        })
      }
    }
    return out
  }, [dashboard.data, outstanding.data])
  return { data, isPending: dashboard.isPending }
}
