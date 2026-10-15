import { useState, type FormEvent } from 'react'

import { useLogin, useSetup } from '../api/hooks'

export function LoginPage() {
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username, password })
  }

  return (
    <main className="auth-page">
      <form className="card stack-form" onSubmit={submit}>
        <img className="auth-logo" src="/logo-mark.png" alt="" />
        <h1>Taddletick</h1>
        <label>
          Username
          <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {login.error && <p className="error">{login.error.message}</p>}
        <button type="submit" className="primary" disabled={login.isPending || !username || !password}>
          Log in
        </button>
      </form>
    </main>
  )
}

/** First run only: the first account becomes the admin and owns everything made so far. */
export function SetupPage() {
  const setup = useSetup()
  const [f, setF] = useState({
    display_name: '',
    username: '',
    password: '',
    confirm: '',
  })
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value })
  const mismatch = f.confirm !== '' && f.password !== f.confirm

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setup.mutate({
      display_name: f.display_name.trim(),
      username: f.username.trim(),
      password: f.password,
    })
  }

  return (
    <main className="auth-page">
      <form className="card stack-form" onSubmit={submit}>
        <img className="auth-logo" src="/logo-mark.png" alt="" />
        <h1>Create the admin account</h1>
        <p className="muted">
          This is the first account. It can add other people, and it takes over every project and task already in the
          app.
        </p>
        <label>
          Your name
          <input required autoFocus value={f.display_name} onChange={(e) => set('display_name', e.target.value)} />
        </label>
        <label>
          Username
          <input
            required
            autoComplete="username"
            pattern="[A-Za-z0-9_.\-]{2,}"
            title="At least 2 characters: letters, numbers, . _ -"
            value={f.username}
            onChange={(e) => set('username', e.target.value)}
          />
        </label>
        <label>
          Password <span className="muted">(at least 8 characters)</span>
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </label>
        <label>
          Password again
          <input
            required
            type="password"
            autoComplete="new-password"
            value={f.confirm}
            onChange={(e) => set('confirm', e.target.value)}
          />
        </label>
        {mismatch && <p className="error">The passwords don't match.</p>}
        {setup.error && <p className="error">{setup.error.message}</p>}
        <button type="submit" className="primary" disabled={setup.isPending || mismatch}>
          Create account
        </button>
      </form>
    </main>
  )
}
