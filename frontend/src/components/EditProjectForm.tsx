import { useState, type FormEvent } from 'react'

import { useCan, useMe, useUpdateProject } from '../api/hooks'
import type { DashboardProject, ProjectFields, ProjectLabel, ProjectUpdate } from '../api/types'
import { toFieldValues, toProjectFields } from '../projectFields'
import { ProjectFieldsForm } from './ProjectFieldsForm'
import { RolePicker } from './RolePicker'

interface Props {
  project: DashboardProject
  onDone: () => void
}

export function EditProjectForm({ project, onDone }: Props) {
  const updateProject = useUpdateProject()
  const { data: me } = useMe()
  const canEdit = useCan('can_edit')
  const isAdmin = useCan('is_admin')
  const [fields, setFields] = useState(() => toFieldValues(project))
  const [roleIds, setRoleIds] = useState(project.allowed_role_ids)
  // Only the creator may make a project personal (it then disappears for everyone else)
  const labels = (['company', 'personal'] as ProjectLabel[]).filter((l) =>
    l === 'company' ? canEdit : project.owner?.id === me?.id,
  )
  const rolesChanged = [...roleIds].sort().join() !== [...project.allowed_role_ids].sort().join()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Send only what changed, so the PATCH can't overwrite anything else
    const next = toProjectFields(fields)
    const changed: ProjectUpdate = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== project[key as keyof ProjectFields]),
    )
    if (isAdmin && rolesChanged && next.label === 'company') changed.allowed_role_ids = roleIds
    if (Object.keys(changed).length === 0) return onDone()
    updateProject.mutate({ id: project.id, body: changed }, { onSuccess: onDone })
  }

  return (
    <form className="edit-project" onSubmit={submit}>
      <ProjectFieldsForm values={fields} onChange={setFields} labels={labels} />
      {isAdmin && fields.label === 'company' && <RolePicker value={roleIds} onChange={setRoleIds} />}
      {updateProject.error && <p className="error">{updateProject.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={updateProject.isPending}>
          Save
        </button>
      </div>
    </form>
  )
}
