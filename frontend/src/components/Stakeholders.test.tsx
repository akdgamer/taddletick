import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CONTACTS, mockFetch, renderWithQuery } from '../test/render'
import { NewProjectForm } from './NewProjectForm'
import { Stakeholders } from './Stakeholders'

function requests(fetchMock: ReturnType<typeof mockFetch>, method: string) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url, init]) => ({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined }))
}

describe('Stakeholders', () => {
  it('offers only people not already on the stage, and adds the chosen one', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<Stakeholders stageId={4} stageName="Design" contacts={[CONTACTS[0]]} />)

    const picker = await screen.findByRole('combobox', { name: 'Add person to Design' })
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '+ Person',
      'Ravi (Valve supplier)',
    ])

    await user.selectOptions(picker, '21')
    expect(requests(fetchMock, 'POST')).toEqual([{ url: expect.stringMatching(/\/stages\/4\/contacts\/21$/), body: undefined }])
  })

  it('shows contact details when a chip is clicked, and removes on ×', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<Stakeholders stageId={4} stageName="Design" contacts={[CONTACTS[0]]} />)

    await user.click(screen.getByRole('button', { name: /^Priya/ }))
    expect(screen.getByRole('link', { name: 'priya@acme.test' })).toHaveAttribute('href', 'mailto:priya@acme.test')
    expect(screen.getByRole('link', { name: '+91 98765' })).toHaveAttribute('href', 'tel:+9198765')

    await user.click(screen.getByRole('button', { name: 'Remove Priya from Design' }))
    expect(requests(fetchMock, 'DELETE')[0].url).toMatch(/\/stages\/4\/contacts\/20$/)
  })
})

describe('client picker in the project form', () => {
  it('sends the chosen client id', async () => {
    const fetchMock = mockFetch()
    const user = userEvent.setup()
    renderWithQuery(<NewProjectForm onDone={() => {}} />)

    await user.type(screen.getByLabelText('Name'), 'Press')
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Client' }), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(requests(fetchMock, 'POST')[0].body).toMatchObject({ name: 'Press', client_id: 3 })
  })

  it('creates a new client inline and selects it', async () => {
    const fetchMock = mockFetch()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body =
        init?.method === 'POST' && url.endsWith('/clients')
          ? { id: 9, name: 'Beta Fab', address: '', notes: '', contacts: [] }
          : url.endsWith('/clients') || url.endsWith('/stage-types')
            ? []
            : {}
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const user = userEvent.setup()
    renderWithQuery(<NewProjectForm onDone={() => {}} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Client' }), '+ New client…')
    await user.type(screen.getByLabelText('New client name'), 'Beta Fab{Enter}')
    await user.type(screen.getByLabelText('Name'), 'Press')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    const posts = requests(fetchMock, 'POST')
    expect(posts[0]).toMatchObject({ url: expect.stringMatching(/\/clients$/), body: { name: 'Beta Fab' } })
    expect(posts[1]).toMatchObject({ url: expect.stringMatching(/\/projects$/), body: { client_id: 9 } })
  })
})
