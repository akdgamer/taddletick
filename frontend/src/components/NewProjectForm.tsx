import { useState, type FormEvent } from 'react'

import { useCreateProject, useStageTypes } from '../api/hooks'
import { EMPTY_FIELDS, toProjectFields } from '../projectFields'
import { ProjectFieldsForm } from './ProjectFieldsForm'
import { StagePicker } from './StagePicker'

export function NewProjectForm({ onDone }: { onDone: () => void }) {
  const createProject = useCreateProject()
  const { data: stageTypes = [] } = useStageTypes()
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [stageIds, setStageIds] = useState<number[]>([])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Stages go in catalog order, whatever order they were ticked in
    const orderedIds = stageTypes.map((t) => t.id).filter((id) => stageIds.includes(id))
    createProject.mutate({ ...toProjectFields(fields), stage_type_ids: orderedIds }, { onSuccess: onDone })
  }

  return (
    <form className="new-project" onSubmit={submit}>
      <h2>New project</h2>
      <ProjectFieldsForm values={fields} onChange={setFields} />
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
