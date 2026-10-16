import { useState, type FormEvent } from 'react'

import { api } from '../api/client'
import { useChangePassword, useGoogleDisconnect, useGoogleStatus, useGoogleSync } from '../api/hooks'
import { timeAgo } from '../format'
import { RestoreIcon } from './Icons'
import { useToast } from './useToast'

const RESULT_MESSAGES: Record<string, string> = {
  connected: 'Google connected. The first sync runs within a few minutes, or press Sync now.',
  denied: 'Google access was not granted.',
  error: 'Connecting to Google failed; see the error below.',
}

export function SettingsPage({ googleResult }: { googleResult: string | null }) {
  const { data: status, isPending, error } = useGoogleStatus()
  const sync = useGoogleSync()
  const disconnect = useGoogleDisconnect()
  const toast = useToast()

  return (
    <main className="page narrow">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <section className="card settings-card">
        <header className="settings-head">
          <div>
            <h2>Google Calendar &amp; Tasks</h2>
            <p className="muted">
              Deadlines from the projects you can see are copied to a "Taddletick" calendar, with a reminder at 9:00 the
              day before: dispatch dates, unfinished stage due dates, and unpaid payments if your role can see them.
              Today's open tasks go to a Google Tasks list of the same name.
            </p>
            <p className="muted small">Copying is one way: changes made in Google are overwritten.</p>
          </div>
          {status?.configured && (
            <span className={`status-badge ${status.connected ? 'on' : 'off'}`}>
              {status.connected ? 'Connected' : 'Not connected'}
            </span>
          )}
        </header>

        {googleResult && RESULT_MESSAGES[googleResult] && <p className="notice">{RESULT_MESSAGES[googleResult]}</p>}
        {isPending && <p className="muted">Checking…</p>}
        {error && <p className="error">{error.message}</p>}

        {status && !status.configured && (
          <div className="notice">
            <p>
              <strong>Not set up on the server yet.</strong> Create an OAuth client in Google Cloud (type "Web
              application"), add this redirect URI, and put its JSON file on the server as{' '}
              <code>secrets/google_client_secret.json</code>:
            </p>
            <code className="block">{status.redirect_uri}</code>
            <p className="muted">Step-by-step instructions are in DEPLOY.md.</p>
          </div>
        )}

        {status?.configured && (
          <div className="connection">
            <div className="connection-info">
              {status.connected ? (
                <>
                  <strong>Last synced</strong>
                  <span className="muted" title={status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : ''}>
                    {status.last_sync_at ? timeAgo(status.last_sync_at) : 'Not yet; the first sync runs within minutes'}
                  </span>
                </>
              ) : (
                <>
                  <strong>No account connected</strong>
                  <span className="muted">You'll be asked to allow access to calendars and tasks it creates.</span>
                </>
              )}
            </div>
            <div className="connection-actions">
              {status.connected ? (
                <>
                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      disconnect.mutate(undefined, { onSuccess: () => toast({ message: 'Google account disconnected' }) })
                    }
                  >
                    Disconnect
                  </button>
                  <a className="button" href={api.googleConnectUrl()}>
                    Reconnect
                  </a>
                  <button
                    className="primary"
                    disabled={sync.isPending}
                    onClick={() => sync.mutate(undefined, { onSuccess: () => toast({ message: 'Synced with Google' }) })}
                  >
                    <span className={sync.isPending ? 'spin' : ''}>
                      <RestoreIcon />
                    </span>
                    {sync.isPending ? 'Syncing…' : 'Sync now'}
                  </button>
                </>
              ) : (
                <a className="button primary" href={api.googleConnectUrl()}>
                  Connect Google account
                </a>
              )}
            </div>
          </div>
        )}
        {status?.last_error && <p className="error">Last error: {status.last_error}</p>}
        {sync.error && <p className="error">{sync.error.message}</p>}
      </section>

      <PasswordSection />
    </main>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const toast = useToast()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value })
  const mismatch = f.confirm !== '' && f.next !== f.confirm

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    change.mutate(
      { current: f.current, next: f.next },
      {
        onSuccess: () => {
          setF({ current: '', next: '', confirm: '' })
          toast({ message: 'Password changed. Other devices were logged out.' })
        },
      },
    )
  }

  return (
    <section className="card settings-card">
      <header className="settings-head">
        <div>
          <h2>Password</h2>
          <p className="muted">Changing it logs you out everywhere else.</p>
        </div>
      </header>
      <form className="stack-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Current password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={f.current}
              onChange={(e) => set('current', e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              required
              type="password"
              minLength={8}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={f.next}
              onChange={(e) => set('next', e.target.value)}
            />
          </label>
          <label>
            New password again
            <input
              required
              type="password"
              autoComplete="new-password"
              value={f.confirm}
              onChange={(e) => set('confirm', e.target.value)}
            />
          </label>
        </div>
        {mismatch && <p className="error">The new passwords don't match.</p>}
        {change.error && <p className="error">{change.error.message}</p>}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={change.isPending || mismatch}>
            Change password
          </button>
        </div>
      </form>
    </section>
  )
}
