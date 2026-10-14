import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ContactsPage } from './components/ContactsPage'
import { DashboardPage } from './components/DashboardPage'
import { SettingsPage } from './components/SettingsPage'
import { TasksPage } from './components/TasksPage'

const queryClient = new QueryClient({
  // Refetch when you come back to the tab/app, e.g. on the phone after a while
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 30_000 } },
})

const PAGES = { projects: 'Projects', tasks: 'Tasks', contacts: 'Contacts', settings: 'Settings' } as const
type Page = keyof typeof PAGES

// The Google sign-in sends the browser back to /?page=settings&google=...
const params = new URLSearchParams(window.location.search)
const initialPage = (params.get('page') as Page) in PAGES ? (params.get('page') as Page) : 'projects'
const googleResult = params.get('google')
if (window.location.search) window.history.replaceState(null, '', window.location.pathname)

export default function App() {
  const [page, setPage] = useState<Page>(initialPage)

  return (
    <QueryClientProvider client={queryClient}>
      <nav className="app-nav" aria-label="Main">
        <span className="app-name">Taddletick</span>
        {(Object.keys(PAGES) as Page[]).map((p) => (
          <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
            {PAGES[p]}
          </button>
        ))}
      </nav>
      {page === 'projects' && <DashboardPage />}
      {page === 'tasks' && <TasksPage />}
      {page === 'contacts' && <ContactsPage />}
      {page === 'settings' && <SettingsPage googleResult={googleResult} />}
    </QueryClientProvider>
  )
}
