import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DashboardProject } from '../api/types'
import { mockFetch, renderWithQuery, FULL_ACCESS } from '../test/render'
import { ProjectTile } from './ProjectTile'

const project: DashboardProject = {
  id: 7,
  name: 'Welding fixture',
  client_id: 3,
  client: { id: 3, name: 'Acme' },
  po_number: '4501',
  label: 'company',
  is_p0: true,
  dispatch_date: '2026-03-04',
  notes: '',
  flag: 'red',
  dispatch_flag: 'amber',
  days_to_dispatch: 3,
  stages: [
    { id: 1, stage_type_id: 2, name: 'Ordering parts', status: 'in_progress', due_date: '2026-02-20', notes: '', position: 1, flag: 'red', contacts: [] },
    { id: 2, stage_type_id: 1, name: 'PO received', status: 'done', due_date: null, notes: '', position: 0, flag: 'none', contacts: [] },
  ],
  payments: [],
  owner: { id: 1, display_name: 'Boss' },
  allowed_role_ids: [],
  access: FULL_ACCESS,
  files: [],
}

describe('ProjectTile', () => {
  beforeEach(() => {
    mockFetch()
    // "Today" is pinned so "N days late" doesn't depend on when the tests run
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 2, 1) })
    return () => vi.useRealTimers()
  })

  it('shows header info, P0 badge and dispatch countdown', () => {
    renderWithQuery(<ProjectTile project={project} />)
    expect(screen.getByRole('heading', { name: 'Welding fixture' })).toBeInTheDocument()
    expect(screen.getByText('P0')).toBeInTheDocument()
    expect(screen.getByText('Acme · PO 4501')).toBeInTheDocument()
    expect(screen.getByText('in 3 days').closest('.dispatch')).toHaveClass('flag-amber')
  })

  it('applies the flags the API sent to the tile and its stages', () => {
    renderWithQuery(<ProjectTile project={project} />)
    expect(screen.getByRole('article', { name: 'Welding fixture' })).toHaveClass('flag-red')

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('Ordering parts')).toBeInTheDocument()
    expect(rows[0]).toHaveClass('flag-red')
    expect(within(rows[0]).getByText('9 days late')).toBeInTheDocument()
  })

  it('folds completed stages away until asked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<ProjectTile project={project} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /1 completed stage/ }))
    const rows = screen.getAllByRole('listitem')
    expect(rows[1]).toHaveClass('status-done')
  })

  it('only offers stages not already on the project', async () => {
    renderWithQuery(<ProjectTile project={project} />)
    const addStage = await screen.findByRole('combobox', { name: 'Add stage' })
    const options = within(addStage).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['+ Add stage', 'Electrical design'])
  })

  it('hides changes the role may not make', () => {
    const readOnly = { can_edit: false, can_delete: false, can_view_payments: false, can_edit_payments: false }
    renderWithQuery(<ProjectTile project={{ ...project, access: readOnly }} />)
    expect(screen.queryByRole('button', { name: 'Actions for Welding fixture' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Add stage' })).not.toBeInTheDocument()
    expect(screen.queryByText('Payments')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Ordering parts status' })).toBeDisabled()
  })
})
