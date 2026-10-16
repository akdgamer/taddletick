import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'

import { api, ApiError } from '../api/client'
import type { DisplayData } from '../api/types'
import { shortDate } from '../format'
import './display.css'

const REFRESH_MS = 60_000
const VERSION_CHECK_MS = 5 * 60_000

// The built page loads one hashed bundle (assets/index-AbC123.js); a new deploy changes the name
const bundleOf = (html: string) => html.match(/assets\/index-[\w-]+\.js/)?.[0] ?? null
const runningBundle = bundleOf(document.documentElement.outerHTML)

/** After an update on the Pi, the always-on screen reloads itself instead of running the old page forever */
async function reloadIfUpdated(): Promise<boolean> {
  if (!runningBundle) return false // dev server: no hashed bundle to compare
  const latest = bundleOf(await (await fetch('/', { cache: 'no-store' })).text())
  if (latest && latest !== runningBundle) window.location.reload()
  return false
}

type Dot = 'ok' | 'warn' | 'bad' | 'off'

/**
 * The desk display: a 480×320 glanceable summary for the Pi's touch screen.
 * Logged in with its own limited login (paired once with a code from the Pi).
 */
const queryClient = new QueryClient()
const KEY = ['display']
const isUnpaired = (e: unknown) => e instanceof ApiError && e.status === 401

export function DisplayPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <Display />
    </QueryClientProvider>
  )
}

function Display() {
  const client = useQueryClient()
  // Keeps the last good data through network blips; only a 401 means "pair me"
  const { data, error } = useQuery({
    queryKey: KEY,
    queryFn: api.displayData,
    refetchInterval: REFRESH_MS,
    retry: (count, e) => !isUnpaired(e) && count < 2,
  })
  const tickTask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.displayTick(id, done),
    // Show the tick straight away; the refetch afterwards corrects it if the save failed
    onMutate: ({ id, done }) =>
      client.setQueryData<DisplayData>(KEY, (d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  })

  useQuery({ queryKey: ['display-version'], queryFn: reloadIfUpdated, refetchInterval: VERSION_CHECK_MS })

  useEffect(() => {
    // The screen is always dark, whatever the main app's theme
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  if (isUnpaired(error)) return <Pairing onPaired={() => client.resetQueries({ queryKey: KEY })} />
  if (!data) return <Centered>{error ? "Can't reach Taddletick. Retrying…" : 'Loading…'}</Centered>

  const tick = (id: number, done: boolean) => tickTask.mutate({ id, done })

  const open = data.tasks.filter((t) => !t.done).length

  return (
    <div className="display">
      <header className="d-head">
        <Clock />
        <Health data={data} />
      </header>

      <main className="d-body">
        <section className="d-col">
          <h2>
            Today <span className="d-count">{data.tasks.length ? `${open} open` : ''}</span>
          </h2>
          {data.tasks.length === 0 ? (
            <p className="d-quiet">Nothing on today's list.</p>
          ) : (
            <ul className="d-tasks">
              {data.tasks.map((t) => (
                <li key={t.id}>
                  <button className={t.done ? 'done' : ''} onClick={() => tick(t.id, !t.done)} aria-pressed={t.done}>
                    <span className="d-box" aria-hidden />
                    <span className="d-task-text">
                      {t.title}
                      {t.days_overdue > 0 && <em> · {t.days_overdue}d overdue</em>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="d-col">
          <h2>
            Needs attention <span className="d-count">{data.alerts.length || ''}</span>
          </h2>
          {data.alerts.length === 0 ? (
            <p className="d-quiet d-calm">All {data.active_projects} projects on track.</p>
          ) : (
            <ul className="d-alerts">
              {data.alerts.map((a) => (
                <li key={a.project_id} className={`flag-${a.flag}`}>
                  <strong>{a.project}</strong>
                  <span>{a.reason}</span>
                </li>
              ))}
            </ul>
          )}
          {data.next_dispatch && (
            <div className="d-dispatch">
              <span className="d-label">Next dispatch</span>
              <strong>{data.next_dispatch.project}</strong>
              <span>
                {shortDate(data.next_dispatch.date)} ·{' '}
                {data.next_dispatch.days === 0 ? 'today' : `in ${data.next_dispatch.days}d`}
              </span>
            </div>
          )}
        </section>
      </main>
      {error && <div className="d-offline">Offline · showing last update</div>}
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="d-clock">
      <strong>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</strong>
      <span>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </div>
  )
}

const hoursSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity)

/** Three dots that only go amber or red when something needs a look */
function Health({ data }: { data: DisplayData }) {
  const h = data.health
  const backupAge = hoursSince(h.backup_at)
  const backup: Dot = backupAge < 26 ? 'ok' : backupAge < 72 ? 'warn' : 'bad'
  const syncAge = hoursSince(h.google_at)
  const sync: Dot = h.google === 'off' ? 'off' : h.google === 'error' ? 'bad' : syncAge < 0.5 ? 'ok' : 'warn'
  const temp: Dot = h.temp_c === null ? 'off' : h.temp_c < 70 ? 'ok' : h.temp_c < 80 ? 'warn' : 'bad'

  return (
    <div className="d-health">
      <span className={`d-dot ${backup}`}>Backup</span>
      <span className={`d-dot ${sync}`}>Sync</span>
      <span className={`d-dot ${temp}`}>{h.temp_c === null ? 'Temp' : `${Math.round(h.temp_c)}°`}</span>
    </div>
  )
}

// Opened with ?pair=CODE (how the Pi's kiosk is first started): pair without typing
const codeFromUrl = new URLSearchParams(window.location.search).get('pair')

function Pairing({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState(codeFromUrl ?? '')
  const pair = useMutation({
    mutationFn: api.displayPair,
    onSuccess: () => {
      window.history.replaceState(null, '', '/?display') // don't keep the used code in the address
      onPaired()
    },
  })
  const { mutate } = pair

  useEffect(() => {
    if (codeFromUrl) mutate(codeFromUrl)
  }, [mutate])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) pair.mutate(code)
  }
  const busy = pair.isPending
  const error = pair.error?.message

  return (
    <div className="display d-pair">
      <img src="/logo-mark.png" alt="" />
      <h1>Pair this display</h1>
      <p>
        On the Pi, run <code>python -m app.pair_display USERNAME</code> in the app container and enter the code.
      </p>
      <form onSubmit={submit}>
        <input
          aria-label="Pairing code"
          placeholder="ABCD-EFGH"
          value={code}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="primary" disabled={busy || !code.trim()}>
          Pair
        </button>
      </form>
      {error && <p className="d-error">{error}</p>}
    </div>
  )
}

function Centered({ children }: { children: string }) {
  return <div className="display d-center">{children}</div>
}
