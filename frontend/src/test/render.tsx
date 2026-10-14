import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'

import type { Client, Contact, StageType } from '../api/types'

export const STAGE_TYPES: StageType[] = [
  { id: 1, name: 'PO received', sort_order: 1 },
  { id: 2, name: 'Ordering parts', sort_order: 2 },
  { id: 5, name: 'Electrical design', sort_order: 5 },
]

export const CONTACTS: Contact[] = [
  { id: 20, name: 'Priya', client_id: 3, client: { id: 3, name: 'Acme' }, role: 'Engineer', phone: '+91 98765', email: 'priya@acme.test', notes: '' },
  { id: 21, name: 'Ravi', client_id: null, client: null, role: 'Valve supplier', phone: '', email: '', notes: '' },
]

export const CLIENTS: Client[] = [{ id: 3, name: 'Acme', address: '', notes: '', contacts: [CONTACTS[0]] }]

/**
 * Stubs fetch: list endpoints return the fixtures above, everything else returns {}.
 * Returns the mock so tests can inspect the requests that were sent.
 */
export function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.endsWith('/stage-types')
      ? STAGE_TYPES
      : url.endsWith('/clients')
        ? CLIENTS
        : /\/contacts(\?|$)/.test(url)
          ? CONTACTS
          : {}
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
