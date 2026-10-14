import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'

import type { StageType } from '../api/types'

export const STAGE_TYPES: StageType[] = [
  { id: 1, name: 'PO received', sort_order: 1 },
  { id: 2, name: 'Ordering parts', sort_order: 2 },
  { id: 5, name: 'Electrical design', sort_order: 5 },
]

/**
 * Stubs fetch: GET /stage-types returns STAGE_TYPES, everything else returns {}.
 * Returns the mock so tests can inspect the requests that were sent.
 */
export function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.endsWith('/stage-types') ? STAGE_TYPES : {}
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
