import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { DashboardProject } from '../api/types'
import { mockFetch, renderWithQuery } from '../test/render'
import { ProjectTile } from './ProjectTile'

const project: DashboardProject = {
  id: 7,
  name: 'Welding fixture',
  client_name: 'Acme',
  po_number: '4501',
  label: 'company',
  is_p0: true,
  dispatch_date: '2026-03-04',
  notes: '',
  flag: 'red',
  dispatch_flag: 'amber',
  days_to_dispatch: 3,
  stages: [
    { id: 1, stage_type_id: 2, name: 'Ordering parts', status: 'in_progress', due_date: '2026-02-20', notes: '', position: 1, flag: 'red' },
    { id: 2, stage_type_id: 1, name: 'PO received', status: 'done', due_date: null, notes: '', position: 0, flag: 'none' },
  ],
}

describe('ProjectTile', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('shows header info, P0 badge and dispatch countdown', () => {
    renderWithQuery(<ProjectTile project={project} />)
    expect(screen.getByRole('heading', { name: 'Welding fixture' })).toBeInTheDocument()
    expect(screen.getByText('P0')).toBeInTheDocument()
    expect(screen.getByText('Acme · PO 4501')).toBeInTheDocument()
    expect(screen.getByText(/Dispatch in 3 days/)).toHaveClass('flag-amber')
  })

  it('applies the flags the API sent to the tile and its stages', () => {
    renderWithQuery(<ProjectTile project={project} />)
    expect(screen.getByRole('article', { name: 'Welding fixture' })).toHaveClass('flag-red')

    const rows = screen.getAllByRole('listitem')
    // Keeps the API's order (done stage already moved to the bottom)
    expect(within(rows[0]).getByText('Ordering parts')).toBeInTheDocument()
    expect(rows[0]).toHaveClass('flag-red')
    expect(rows[1]).toHaveClass('status-done')
  })

  it('only offers stages not already on the project', async () => {
    renderWithQuery(<ProjectTile project={project} />)
    const addStage = await screen.findByRole('combobox', { name: 'Add stage' })
    const options = within(addStage).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['+ Add stage…', 'Electrical design'])
  })
})
