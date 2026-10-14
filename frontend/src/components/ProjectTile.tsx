import { useState } from 'react'

import { useAddStage, useDeleteProject, useStageTypes, useUpdateProject } from '../api/hooks'
import type { DashboardProject } from '../api/types'
import { dispatchText, formatDate } from '../format'
import { StageRow } from './StageRow'

export function ProjectTile({ project }: { project: DashboardProject }) {
  const { data: stageTypes = [] } = useStageTypes()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const addStage = useAddStage()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const usedTypeIds = new Set(project.stages.map((s) => s.stage_type_id))
  const availableTypes = stageTypes.filter((t) => !usedTypeIds.has(t.id))
  const error = updateProject.error ?? deleteProject.error ?? addStage.error

  return (
    <article className={`tile flag-${project.flag}`} aria-label={project.name}>
      <header className="tile-header">
        <h2>{project.name}</h2>
        <div className="badges">
          {project.is_p0 && <span className="badge badge-p0">P0</span>}
          {project.label === 'personal' && <span className="badge">Personal</span>}
        </div>
      </header>

      {(project.client_name || project.po_number) && (
        <p className="tile-meta">
          {[project.client_name, project.po_number && `PO ${project.po_number}`].filter(Boolean).join(' · ')}
        </p>
      )}

      <p className={`dispatch flag-${project.dispatch_flag}`}>
        {dispatchText(project.days_to_dispatch)}
        {project.dispatch_date && <span className="muted"> · {formatDate(project.dispatch_date)}</span>}
      </p>

      {project.notes && <p className="tile-notes">{project.notes}</p>}

      {project.stages.length > 0 ? (
        <ul className="stages">
          {project.stages.map((stage) => (
            <StageRow key={stage.id} stage={stage} />
          ))}
        </ul>
      ) : (
        <p className="muted">No stages yet.</p>
      )}

      {error && <p className="error">{error.message}</p>}

      <footer className="tile-actions">
        {availableTypes.length > 0 && (
          <select
            aria-label="Add stage"
            value=""
            onChange={(e) =>
              addStage.mutate({ projectId: project.id, body: { stage_type_id: Number(e.target.value) } })
            }
          >
            <option value="">+ Add stage…</option>
            {availableTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => updateProject.mutate({ id: project.id, body: { is_p0: !project.is_p0 } })}>
          {project.is_p0 ? 'Unmark P0' : 'Mark P0'}
        </button>
        <button onClick={() => updateProject.mutate({ id: project.id, body: { is_completed: true } })}>
          Complete
        </button>
        {confirmingDelete ? (
          <>
            <button className="danger" onClick={() => deleteProject.mutate(project.id)}>
              Confirm delete
            </button>
            <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmingDelete(true)}>Delete</button>
        )}
      </footer>
    </article>
  )
}
