import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ContactsPage } from './components/ContactsPage'
import { DashboardPage } from './components/DashboardPage'

const queryClient = new QueryClient()

type Page = 'projects' | 'contacts'

export default function App() {
  const [page, setPage] = useState<Page>('projects')

  return (
    <QueryClientProvider client={queryClient}>
      <nav className="app-nav" aria-label="Main">
        <span className="app-name">Taddletick</span>
        {(['projects', 'contacts'] as const).map((p) => (
          <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
            {p === 'projects' ? 'Projects' : 'Contacts'}
          </button>
        ))}
      </nav>
      {page === 'projects' ? <DashboardPage /> : <ContactsPage />}
    </QueryClientProvider>
  )
}
