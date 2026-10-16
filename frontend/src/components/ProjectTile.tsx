import { useState } from 'react'

import { useAddStage, useDeleteProject, useUpdateProject } from '../api/hooks'
import type { DashboardProject } from '../api/types'
import { plural, relativeDays, shortDate } from '../format'
import { EditProjectForm } from './EditProjectForm'
import { FilesSection } from './FilesSection'
import { HistorySection } from './HistorySection'
import { ChevronIcon, Menu } from './Menu'
import { NotesSection } from './NotesSection'
import { PaymentsSection } from './PaymentsSection'
import { StageRow } from './StageRow'
import { StageSearch } from './StageSearch'
import { afterSave, useToast } from './useToast'

export function ProjectTile({ project }: { project: DashboardProject }) {
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const addStage = useAddStage()
  const toast = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const { access } = project
  // The API puts finished stages last; they fold away under one line
  const openStages = project.stages.filter((s) => s.status !== 'done')
  const doneStages = project.stages.filter((s) => s.status === 'done')
  const error = updateProject.error ?? deleteProject.error ?? addStage.error
  const meta = [project.client?.name, project.po_number && `PO ${project.po_number}`].filter(Boolean).join(' · ')
  const stageProps = { canEdit: access.can_edit, canDelete: access.can_delete }

  return (
    <article id={`project-${project.id}`} className={`tile flag-${project.flag}`} aria-label={project.name}>
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
                          afterSave(updateProject.mutateAsync({ id: project.id, body: { is_completed: true } }), () =>
                            toast({
                              message: `${project.name} moved to Completed`,
                              action: {
                                label: 'Undo',
                                run: () => updateProject.mutate({ id: project.id, body: { is_completed: false } }),
                              },
                            }),
                          )
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
          <button
            className="danger"
            onClick={() =>
              afterSave(deleteProject.mutateAsync(project.id), () => toast({ message: `${project.name} deleted` }))
            }
          >
            Delete
          </button>
          <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
        </div>
      )}

      {!editing && project.notes && <p className="tile-notes">{project.notes}</p>}
      {project.stages.length > 0 && <StageProgress stages={project.stages} />}

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
        {access.can_edit && (
          <StageSearch
            exclude={project.stages.map((s) => s.stage_type_id)}
            label="+ Add stage"
            busy={addStage.isPending}
            onPick={(t) => addStage.mutate({ projectId: project.id, body: { stage_type_id: t.id } })}
          />
        )}
      </div>

      <NotesSection
        projectId={project.id}
        notes={project.log}
        canAdd={access.can_edit}
        canDelete={access.can_delete}
      />
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
      <HistorySection projectId={project.id} />

      {error && <p className="error">{error.message}</p>}
    </article>
  )
}

/** One segment per stage, coloured by status: how far along the build is at a glance */
function StageProgress({ stages }: { stages: DashboardProject['stages'] }) {
  const done = stages.filter((s) => s.status === 'done').length
  const order: Record<string, number> = { done: 0, in_progress: 1, blocked: 2, not_started: 3 }
  const sorted = [...stages].sort((a, b) => order[a.status] - order[b.status])
  const label = `${done} of ${stages.length} stages done`
  return (
    <div className="progress" role="img" aria-label={label} title={label}>
      <div className="progress-track">
        {sorted.map((s) => (
          <span key={s.id} className={`progress-seg seg-${s.status}`} />
        ))}
      </div>
      <span className="progress-text">
        {done}/{stages.length}
      </span>
    </div>
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
