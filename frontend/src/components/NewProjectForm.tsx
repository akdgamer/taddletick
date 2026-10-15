import { useState, type FormEvent } from 'react'

import { useCan, useCreateProject, useStageTypes } from '../api/hooks'
import type { ProjectLabel } from '../api/types'
import { EMPTY_FIELDS, toProjectFields } from '../projectFields'
import { ProjectFieldsForm } from './ProjectFieldsForm'
import { RolePicker } from './RolePicker'
import { StagePicker } from './StagePicker'

export function NewProjectForm({ onDone }: { onDone: () => void }) {
  const createProject = useCreateProject()
  const { data: stageTypes = [] } = useStageTypes()
  const canEdit = useCan('can_edit')
  const isAdmin = useCan('is_admin')
  // Roles without editing rights can still keep their own personal projects
  const labels: ProjectLabel[] = canEdit ? ['company', 'personal'] : ['personal']
  const [chosen, setFields] = useState(EMPTY_FIELDS)
  // Worked out on every render, not once: the user's role may load after the form
  const fields = labels.includes(chosen.label) ? chosen : { ...chosen, label: labels[0] }
  const [stageIds, setStageIds] = useState<number[]>([])
  const [roleIds, setRoleIds] = useState<number[]>([])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Stages go in catalog order, whatever order they were ticked in
    const orderedIds = stageTypes.map((t) => t.id).filter((id) => stageIds.includes(id))
    createProject.mutate(
      {
        ...toProjectFields(fields),
        stage_type_ids: orderedIds,
        allowed_role_ids: fields.label === 'company' ? roleIds : [],
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="new-project" onSubmit={submit}>
      <h2>New project</h2>
      <ProjectFieldsForm values={fields} onChange={setFields} labels={labels} />
      {isAdmin && fields.label === 'company' && <RolePicker value={roleIds} onChange={setRoleIds} />}
      <StagePicker selected={stageIds} onChange={setStageIds} />

      {createProject.error && <p className="error">{createProject.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={createProject.isPending}>
          Create project
        </button>
      </div>
    </form>
  )
}
