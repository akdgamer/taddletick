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
    // Tick out of order: Electrical design first, then PO received
    await user.click(await screen.findByLabelText('Electrical design'))
    await user.click(screen.getByLabelText('PO received'))
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(String(url)).toMatch(/\/projects$/)
    expect(JSON.parse(String(init!.body))).toEqual({
      name: 'Press line',
      client_name: null,
      po_number: 'PO-9',
      label: 'company',
      is_p0: false,
      dispatch_date: null,
      notes: '',
      stage_type_ids: [1, 5],
    })
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
