import { useState } from 'react'

import { useCompletedProjects, useDeleteProject, useUpdateProject } from '../api/hooks'
import type { Project } from '../api/types'
import { formatDate } from '../format'
import { IconButton, RestoreIcon, TrashIcon } from './Icons'

export function CompletedList() {
  const { data: projects, isPending, error } = useCompletedProjects()

  if (isPending) return <p className="muted">Loading…</p>
  if (error) return <p className="error">Couldn't load completed projects: {error.message}</p>
  if (projects.length === 0) return <p className="muted">No completed projects yet.</p>

  return (
    <ul className="completed-list">
      {projects.map((project) => (
        <CompletedRow key={project.id} project={project} />
      ))}
    </ul>
  )
}

function CompletedRow({ project }: { project: Project }) {
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const error = updateProject.error ?? deleteProject.error

  const details = [
    project.client?.name,
    project.po_number && `PO ${project.po_number}`,
    project.dispatch_date && `Dispatch ${formatDate(project.dispatch_date)}`,
    project.label === 'personal' && 'Personal',
  ].filter(Boolean)

  return (
    <li className="completed-row" aria-label={project.name}>
      <div>
        <strong>{project.name}</strong>
        {details.length > 0 && <p className="tile-meta">{details.join(' · ')}</p>}
        {error && <p className="error">{error.message}</p>}
      </div>
      <div className="row-actions">
        {project.access.can_edit && (
          <IconButton
            label="Restore"
            tone="ok"
            icon={<RestoreIcon />}
            onClick={() => updateProject.mutate({ id: project.id, body: { is_completed: false } })}
          />
        )}
        {project.access.can_delete &&
          (confirmingDelete ? (
            <>
              <button className="danger" onClick={() => deleteProject.mutate(project.id)}>
                Confirm delete
              </button>
              <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </>
          ) : (
            <IconButton label="Delete project" tone="danger" icon={<TrashIcon />} onClick={() => setConfirmingDelete(true)} />
          ))}
      </div>
    </li>
  )
}
