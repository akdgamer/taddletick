import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DashboardProject } from '../api/types'
import { mockFetch, renderWithQuery } from '../test/render'
import { CompletedList } from './CompletedList'
import { ProjectTile } from './ProjectTile'

const project: DashboardProject = {
  id: 7,
  name: 'Welding fixture',
  client_id: 3,
  client: { id: 3, name: 'Acme' },
  po_number: '4501',
  label: 'company',
  is_p0: false,
  dispatch_date: '2026-03-04',
  notes: '',
  flag: 'none',
  dispatch_flag: 'none',
  days_to_dispatch: 30,
  stages: [],
  payments: [],
  files: [],
}

function sentRequest(fetchMock: ReturnType<typeof mockFetch>, method: string) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)
  return call && { url: String(call[0]), body: JSON.parse(String(call[1]!.body)) }
}

describe('editing a project', () => {
  it('opens the edit form prefilled and sends only changed fields', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<ProjectTile project={project} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const po = screen.getByLabelText('PO number')
    expect(po).toHaveValue('4501')

    await user.clear(po)
    await user.clear(screen.getByLabelText('Dispatch date'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(sentRequest(fetchMock, 'PATCH')).toEqual({
      url: expect.stringMatching(/\/projects\/7$/),
      // Cleared fields become null; untouched fields aren't sent at all
      body: { po_number: null, dispatch_date: null },
    })
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
  })

  it('cancel leaves the project untouched', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<ProjectTile project={project} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Name'), ' v2')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(sentRequest(fetchMock, 'PATCH')).toBeUndefined()
    expect(screen.getByRole('heading', { name: 'Welding fixture' })).toBeInTheDocument()
  })
})

describe('CompletedList', () => {
  it('restores a completed project', async () => {
    const fetchMock = mockFetch()
    fetchMock.mockImplementation(async (input, init) => {
      const body = String(input).includes('completed=true') && init?.method === 'GET' ? [{ ...project, is_completed: true }] : {}
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const user = userEvent.setup()
    renderWithQuery(<CompletedList />)

    await user.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(sentRequest(fetchMock, 'PATCH')).toEqual({
      url: expect.stringMatching(/\/projects\/7$/),
      body: { is_completed: false },
    })
  })
})
