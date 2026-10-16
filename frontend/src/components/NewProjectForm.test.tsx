import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { mockFetch, renderWithQuery } from '../test/render'
import { NewProjectForm } from './NewProjectForm'

describe('NewProjectForm', () => {
  it('sends the project with picked stages in catalog order', async () => {
    const fetchMock = mockFetch()
    const onDone = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<NewProjectForm onDone={onDone} />)

    await user.type(screen.getByLabelText('Name'), 'Press line')
    await user.type(screen.getByLabelText('PO number'), ' PO-9 ')
    // Pick out of order: Electrical design first (by searching), then PO received
    await user.click(screen.getByRole('button', { name: '+ Add stages' }))
    await user.type(screen.getByRole('combobox', { name: 'Search stages' }), 'elec{Enter}')
    await user.click(screen.getByRole('button', { name: '+ Add another stage' }))
    await user.click(await screen.findByRole('option', { name: 'PO received' }))
    expect(screen.getByRole('button', { name: 'Remove Electrical design' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(String(url)).toMatch(/\/projects$/)
    expect(JSON.parse(String(init!.body))).toEqual({
      name: 'Press line',
      client_id: null,
      po_number: 'PO-9',
      label: 'company',
      is_p0: false,
      dispatch_date: null,
      notes: '',
      stage_type_ids: [1, 5],
      allowed_role_ids: [],
    })
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('warns about similar stages before creating a new one', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<NewProjectForm onDone={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Add stages' }))
    const search = screen.getByRole('combobox', { name: 'Search stages' })
    await user.type(search, 'electric design')
    expect(await screen.findByText(/Similar stages already exist: Electrical design/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '+ Create “electric design”' })).toBeInTheDocument()

    // The same name in other capitals isn't offered as new
    await user.clear(search)
    await user.type(search, 'PO RECEIVED')
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'Painting{Enter}')
    const post = await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, i]) => String(url).endsWith('/stage-types') && i?.method === 'POST')
      expect(call).toBeDefined()
      return call!
    })
    expect(JSON.parse(String(post[1]!.body))).toEqual({ name: 'Painting' })
  })
})
