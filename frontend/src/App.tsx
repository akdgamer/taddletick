import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError } from './api/client'
import { useCan, useLogout, useMe, useSetupNeeded } from './api/hooks'
import type { User } from './api/types'
import { ContactsPage } from './components/ContactsPage'
import { DashboardPage } from './components/DashboardPage'
import { LoginPage, SetupPage } from './components/LoginPage'
import { SettingsPage } from './components/SettingsPage'
import { TasksPage } from './components/TasksPage'
import { ThemeToggle } from './components/ThemeToggle'
import { UsersPage } from './components/UsersPage'

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // A 401 anywhere means the session ended (expired, logged out, deactivated): back to login
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== 'me') {
        queryClient.invalidateQueries({ queryKey: ['me'] })
      }
    },
  }),
  // Refetch when you come back to the tab/app, e.g. on the phone after a while
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, staleTime: 30_000 },
  },
})

const PAGES = {
  projects: 'Projects',
  tasks: 'Tasks',
  contacts: 'Contacts',
  users: 'Users',
  settings: 'Settings',
} as const
type Page = keyof typeof PAGES

// The Google sign-in sends the browser back to /?page=settings&google=...
const params = new URLSearchParams(window.location.search)
const initialPage = (params.get('page') as Page) in PAGES ? (params.get('page') as Page) : 'projects'
const googleResult = params.get('google')
if (window.location.search) window.history.replaceState(null, '', window.location.pathname)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  )
}

function AuthGate() {
  const setup = useSetupNeeded()
  const me = useMe()

  if (setup.error) return <p className="error page">Can't reach the server: {setup.error.message}</p>
  if (setup.data?.needed) return <SetupPage />
  if (setup.isPending || me.isPending) return null
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) return <LoginPage />
    return <p className="error page">Can't reach the server: {me.error.message}</p>
  }
  return <Shell user={me.data} />
}

function Shell({ user }: { user: User }) {
  const isAdmin = useCan('is_admin')
  const logout = useLogout()
  const [page, setPage] = useState<Page>(initialPage === 'users' && !isAdmin ? 'projects' : initialPage)
  const pages = (Object.keys(PAGES) as Page[]).filter((p) => p !== 'users' || isAdmin)

  return (
    <>
      <nav className="app-nav" aria-label="Main">
        <span className="app-name">
          <img src="/logo-mark.png" alt="" />
          Taddletick
        </span>
        {pages.map((p) => (
          <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
            {PAGES[p]}
          </button>
        ))}
        <span className="nav-end">
          <ThemeToggle />
          <span className="nav-user" title={`${user.username} · ${user.role.name}`}>
            {user.display_name}
          </span>
          <button onClick={() => logout.mutate()}>Log out</button>
        </span>
      </nav>
      {page === 'projects' && <DashboardPage />}
      {page === 'tasks' && <TasksPage />}
      {page === 'contacts' && <ContactsPage />}
      {page === 'users' && isAdmin && <UsersPage />}
      {page === 'settings' && <SettingsPage googleResult={googleResult} />}
    </>
  )
}
