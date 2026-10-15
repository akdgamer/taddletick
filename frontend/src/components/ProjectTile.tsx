import { useState } from 'react'

import { useAddStage, useDeleteProject, useStageTypes, useUpdateProject } from '../api/hooks'
import type { DashboardProject } from '../api/types'
import { dispatchText, formatDate } from '../format'
import { EditProjectForm } from './EditProjectForm'
import { FilesSection } from './FilesSection'
import { PaymentsSection } from './PaymentsSection'
import { StageRow } from './StageRow'

export function ProjectTile({ project }: { project: DashboardProject }) {
  const { data: stageTypes = [] } = useStageTypes()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const addStage = useAddStage()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  const { access } = project
  const usedTypeIds = new Set(project.stages.map((s) => s.stage_type_id))
  const availableTypes = stageTypes.filter((t) => !usedTypeIds.has(t.id))
  const error = updateProject.error ?? deleteProject.error ?? addStage.error

  return (
    <article className={`tile flag-${project.flag}`} aria-label={project.name}>
      {editing ? (
        <EditProjectForm project={project} onDone={() => setEditing(false)} />
      ) : (
        <>
          <header className="tile-header">
            <h2>{project.name}</h2>
            <div className="badges">
              {project.is_p0 && <span className="badge badge-p0">P0</span>}
              {project.label === 'personal' && <span className="badge">Personal</span>}
              {project.allowed_role_ids.length > 0 && (
                <span className="badge" title="Only some roles can see this project">
                  Restricted
                </span>
              )}
              {access.can_edit && (
                <button className="link-button" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
          </header>

          {(project.client || project.po_number) && (
            <p className="tile-meta">
              {[project.client?.name, project.po_number && `PO ${project.po_number}`].filter(Boolean).join(' · ')}
            </p>
          )}

          <p className={`dispatch flag-${project.dispatch_flag}`}>
            {dispatchText(project.days_to_dispatch)}
            {project.dispatch_date && <span className="muted"> · {formatDate(project.dispatch_date)}</span>}
          </p>

          {project.notes && <p className="tile-notes">{project.notes}</p>}
        </>
      )}

      {project.stages.length > 0 ? (
        <ul className="stages">
          {project.stages.map((stage) => (
            <StageRow key={stage.id} stage={stage} canEdit={access.can_edit} canDelete={access.can_delete} />
          ))}
        </ul>
      ) : (
        <p className="muted">No stages yet.</p>
      )}

      {access.can_view_payments && (
        <PaymentsSection
          projectId={project.id}
          payments={project.payments}
          canEdit={access.can_edit_payments}
          canDelete={access.can_edit_payments && access.can_delete}
        />
      )}
      <FilesSection
        projectId={project.id}
        files={project.files}
        canUpload={access.can_edit}
        canDelete={access.can_delete}
      />

      {error && <p className="error">{error.message}</p>}

      {(access.can_edit || access.can_delete) && (
        <footer className="tile-actions">
          {access.can_edit && availableTypes.length > 0 && (
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
          {access.can_edit && (
            <>
              <button onClick={() => updateProject.mutate({ id: project.id, body: { is_p0: !project.is_p0 } })}>
                {project.is_p0 ? 'Unmark P0' : 'Mark P0'}
              </button>
              <button onClick={() => updateProject.mutate({ id: project.id, body: { is_completed: true } })}>
                Complete
              </button>
            </>
          )}
          {access.can_delete &&
            (confirmingDelete ? (
              <>
                <button className="danger" onClick={() => deleteProject.mutate(project.id)}>
                  Confirm delete
                </button>
                <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmingDelete(true)}>Delete</button>
            ))}
        </footer>
      )}
    </article>
  )
}
