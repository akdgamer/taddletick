import { useState, type FormEvent } from 'react'

import { api } from '../api/client'
import { useChangePassword, useGoogleDisconnect, useGoogleStatus, useGoogleSync } from '../api/hooks'

const RESULT_MESSAGES: Record<string, string> = {
  connected: 'Google connected. The first sync runs within a few minutes, or press Sync now.',
  denied: 'Google access was not granted.',
  error: 'Connecting to Google failed; see the error below.',
}

export function SettingsPage({ googleResult }: { googleResult: string | null }) {
  const { data: status, isPending, error } = useGoogleStatus()
  const sync = useGoogleSync()
  const disconnect = useGoogleDisconnect()

  return (
    <main className="page narrow">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <section className="card">
        <h2>Google Calendar &amp; Tasks</h2>
        <p className="muted">
          Connect your own Google account. Dispatch dates, unfinished stage due dates and (if your role can see them)
          unpaid payment due dates of the projects you can see are copied to a calendar named "Taddletick", with a
          reminder at 9:00 the day before. Your open tasks for today go to a Google Tasks list of the same name. Copying
          is one way: changes made in Google are overwritten.
        </p>

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
          <>
            <p>
              Status: <strong>{status.connected ? 'Connected' : 'Not connected'}</strong>
              {status.last_sync_at && (
                <span className="muted"> · last synced {new Date(status.last_sync_at).toLocaleString()}</span>
              )}
            </p>
            {status.last_error && <p className="error">Last error: {status.last_error}</p>}
            <div className="row-actions">
              {status.connected ? (
                <>
                  <button className="primary" onClick={() => sync.mutate()} disabled={sync.isPending}>
                    {sync.isPending ? 'Syncing…' : 'Sync now'}
                  </button>
                  <a className="button" href={api.googleConnectUrl()}>
                    Reconnect
                  </a>
                  <button onClick={() => disconnect.mutate()}>Disconnect</button>
                </>
              ) : (
                <a className="button primary" href={api.googleConnectUrl()}>
                  Connect Google account
                </a>
              )}
            </div>
            {sync.isSuccess && <p className="muted">Sync finished.</p>}
            {sync.error && <p className="error">{sync.error.message}</p>}
          </>
        )}
      </section>

      <PasswordSection />
    </main>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value })
  const mismatch = f.confirm !== '' && f.next !== f.confirm

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    change.mutate(
      { current: f.current, next: f.next },
      { onSuccess: () => setF({ current: '', next: '', confirm: '' }) },
    )
  }

  return (
    <section className="card">
      <h2>Password</h2>
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
            New password <span className="muted">(8+ characters)</span>
            <input
              required
              type="password"
              minLength={8}
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
        {change.isSuccess && <p className="muted">Password changed. Other devices have been logged out.</p>}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={change.isPending || mismatch}>
            Change password
          </button>
        </div>
      </form>
    </section>
  )
}
