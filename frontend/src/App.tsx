import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { ApiError } from './api/client'
import { useCan, useLogout, useMe, useSetupNeeded } from './api/hooks'
import type { User } from './api/types'
import { initials } from './format'
import { ActivityPage } from './components/ActivityPage'
import { CalendarPage } from './components/CalendarPage'
import { CommandPalette, SearchIcon } from './components/CommandPalette'
import { ContactsPage } from './components/ContactsPage'
import { DashboardPage } from './components/DashboardPage'
import { LoginPage, SetupPage } from './components/LoginPage'
import { Menu } from './components/Menu'
import { SettingsPage } from './components/SettingsPage'
import { TasksPage } from './components/TasksPage'
import { ThemeToggle } from './components/ThemeToggle'
import { ToastProvider } from './components/Toast'
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
  calendar: 'Calendar',
  tasks: 'Tasks',
  contacts: 'Contacts',
  activity: 'Activity',
  users: 'Users',
  settings: 'Settings',
} as const
type Page = keyof typeof PAGES

// The Google sign-in sends the browser back to /?page=settings&google=...
const params = new URLSearchParams(window.location.search)
const initialPage = (params.get('page') as Page) in PAGES ? (params.get('page') as Page) : 'projects'
const googleResult = params.get('google')
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
// (?display is the desk display's address; main.tsx needs to see it)
if (window.location.search && !params.has('display')) window.history.replaceState(null, '', window.location.pathname)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthGate />
      </ToastProvider>
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
  const [paletteOpen, setPaletteOpen] = useState(false)

  // ⌘K / Ctrl+K anywhere opens the palette; pressing it again closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Settings lives in the user menu; the tabs are the everyday pages
  const tabs = (Object.keys(PAGES) as Page[]).filter((p) => p !== 'settings' && (p !== 'users' || isAdmin))

  return (
    <>
      <header className="app-bar">
        <nav className="app-nav" aria-label="Main">
          <span className="app-name">
            <img src="/logo-mark.png" alt="" />
            <span className="app-title">Taddletick</span>
          </span>
          <div className="nav-tabs">
            {tabs.map((p) => (
              <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
                {PAGES[p]}
              </button>
            ))}
          </div>
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search (⌘K)">
            <SearchIcon />
            <span className="search-trigger-text">Search…</span>
            <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <Menu
            label="Account"
            triggerClassName="avatar-button"
            trigger={
              <>
                <span className="avatar" aria-hidden>
                  {initials(user.display_name)}
                </span>
                <span className="avatar-name">{user.display_name}</span>
              </>
            }
          >
            {(close) => (
              <>
                <div className="menu-header">
                  <strong>{user.display_name}</strong>
                  <span className="muted">
                    {user.username} · {user.role.name}
                  </span>
                </div>
                <div className="menu-section">
                  <span className="menu-label">Appearance</span>
                  <ThemeToggle />
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setPage('settings')
                    close()
                  }}
                >
                  Settings
                </button>
                <button role="menuitem" onClick={() => logout.mutate()}>
                  Log out
                </button>
              </>
            )}
          </Menu>
        </nav>
      </header>
      {page === 'projects' && <DashboardPage />}
      {page === 'calendar' && <CalendarPage onOpenProject={() => setPage('projects')} />}
      {page === 'tasks' && <TasksPage />}
      {page === 'contacts' && <ContactsPage />}
      {page === 'activity' && <ActivityPage />}
      {page === 'users' && isAdmin && <UsersPage />}
      {page === 'settings' && <SettingsPage googleResult={googleResult} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setPage} />
    </>
  )
}
