import { useState } from 'react'

import { useAddStage, useDeleteProject, useStageTypes, useUpdateProject } from '../api/hooks'
import type { DashboardProject } from '../api/types'
import { plural, relativeDays, shortDate } from '../format'
import { EditProjectForm } from './EditProjectForm'
import { FilesSection } from './FilesSection'
import { ChevronIcon, Menu } from './Menu'
import { PaymentsSection } from './PaymentsSection'
import { StageRow } from './StageRow'

export function ProjectTile({ project }: { project: DashboardProject }) {
  const { data: stageTypes = [] } = useStageTypes()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const addStage = useAddStage()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const { access } = project
  const usedTypeIds = new Set(project.stages.map((s) => s.stage_type_id))
  const availableTypes = stageTypes.filter((t) => !usedTypeIds.has(t.id))
  // The API puts finished stages last; they fold away under one line
  const openStages = project.stages.filter((s) => s.status !== 'done')
  const doneStages = project.stages.filter((s) => s.status === 'done')
  const error = updateProject.error ?? deleteProject.error ?? addStage.error
  const meta = [project.client?.name, project.po_number && `PO ${project.po_number}`].filter(Boolean).join(' · ')
  const stageProps = { canEdit: access.can_edit, canDelete: access.can_delete }

  return (
    <article className={`tile flag-${project.flag}`} aria-label={project.name}>
      {editing ? (
        <EditProjectForm project={project} onDone={() => setEditing(false)} />
      ) : (
        <header className="tile-header">
          <div className="tile-title">
            <h2>{project.name}</h2>
            <div className="badges">
              {project.is_p0 && <span className="badge badge-p0">P0</span>}
              {project.label === 'personal' && <span className="badge">Personal</span>}
              {project.allowed_role_ids.length > 0 && (
                <span className="badge" title="Only some roles can see this project">
                  Restricted
                </span>
              )}
            </div>
            {meta && <p className="tile-meta">{meta}</p>}
          </div>
          <Dispatch project={project} />
          {(access.can_edit || access.can_delete) && (
            <Menu label={`Actions for ${project.name}`}>
              {(close) => (
                <>
                  {access.can_edit && (
                    <>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setEditing(true)
                          close()
                        }}
                      >
                        Edit details
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          updateProject.mutate({ id: project.id, body: { is_p0: !project.is_p0 } })
                          close()
                        }}
                      >
                        {project.is_p0 ? 'Unmark P0' : 'Mark as P0'}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          updateProject.mutate({ id: project.id, body: { is_completed: true } })
                          close()
                        }}
                      >
                        Mark completed
                      </button>
                    </>
                  )}
                  {access.can_delete && (
                    <button
                      role="menuitem"
                      className="danger-text"
                      onClick={() => {
                        setConfirmingDelete(true)
                        close()
                      }}
                    >
                      Delete project…
                    </button>
                  )}
                </>
              )}
            </Menu>
          )}
        </header>
      )}

      {confirmingDelete && (
        <div className="confirm-bar" role="alert">
          <span>Delete this project, its stages, payments and files?</span>
          <button className="danger" onClick={() => deleteProject.mutate(project.id)}>
            Delete
          </button>
          <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
        </div>
      )}

      {!editing && project.notes && <p className="tile-notes">{project.notes}</p>}

      <ul className="stages">
        {openStages.map((stage) => (
          <StageRow key={stage.id} stage={stage} {...stageProps} />
        ))}
        {showDone && doneStages.map((stage) => <StageRow key={stage.id} stage={stage} {...stageProps} />)}
      </ul>
      {project.stages.length === 0 && <p className="muted empty">No stages yet.</p>}

      <div className="stage-footer">
        {doneStages.length > 0 && (
          <button className="text-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <ChevronIcon open={showDone} />
            {plural(doneStages.length, 'completed stage')}
          </button>
        )}
        {access.can_edit && availableTypes.length > 0 && (
          <select
            className="ghost-select"
            aria-label="Add stage"
            value=""
            onChange={(e) =>
              addStage.mutate({ projectId: project.id, body: { stage_type_id: Number(e.target.value) } })
            }
          >
            <option value="">+ Add stage</option>
            {availableTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

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
    </article>
  )
}

/** The project's main deadline, top right: date plus how far away it is */
function Dispatch({ project }: { project: DashboardProject }) {
  const days = project.days_to_dispatch
  if (project.dispatch_date === null || days === null) {
    return <div className="dispatch muted">No dispatch date</div>
  }
  return (
    <div className={`dispatch flag-${project.dispatch_flag}`}>
      <span className="dispatch-label">Dispatch</span>
      <strong>{shortDate(project.dispatch_date)}</strong>
      <span className="dispatch-relative">{relativeDays(days)}</span>
    </div>
  )
}
