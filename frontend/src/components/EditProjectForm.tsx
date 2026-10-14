import { useState, type FormEvent } from 'react'

import { useUpdateProject } from '../api/hooks'
import type { DashboardProject, ProjectFields } from '../api/types'
import { toFieldValues, toProjectFields } from '../projectFields'
import { ProjectFieldsForm } from './ProjectFieldsForm'

interface Props {
  project: DashboardProject
  onDone: () => void
}

export function EditProjectForm({ project, onDone }: Props) {
  const updateProject = useUpdateProject()
  const [fields, setFields] = useState(() => toFieldValues(project))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Send only what changed, so the PATCH can't overwrite anything else
    const next = toProjectFields(fields)
    const changed = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== project[key as keyof ProjectFields]),
    )
    if (Object.keys(changed).length === 0) return onDone()
    updateProject.mutate({ id: project.id, body: changed }, { onSuccess: onDone })
  }

  return (
    <form className="edit-project" onSubmit={submit}>
      <ProjectFieldsForm values={fields} onChange={setFields} />
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
