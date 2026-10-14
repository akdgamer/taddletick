import { useState } from 'react'

import { useCreateStageType, useStageTypes } from '../api/hooks'

interface Props {
  selected: number[]
  onChange: (ids: number[]) => void
}

/** Pick stages from the catalog, or add a new stage type to it. */
export function StagePicker({ selected, onChange }: Props) {
  const { data: stageTypes = [] } = useStageTypes()
  const createStageType = useCreateStageType()
  const [newName, setNewName] = useState('')

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  const addType = () => {
    const name = newName.trim()
    if (!name) return
    createStageType.mutate(name, {
      onSuccess: (created) => {
        onChange([...selected, created.id])
        setNewName('')
      },
    })
  }

  return (
    <fieldset className="stage-picker">
      <legend>Stages</legend>
      <div className="stage-options">
        {stageTypes.map((t) => (
          <label key={t.id} className="checkbox">
            <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
            {t.name}
          </label>
        ))}
      </div>
      <div className="inline-add">
        <input
          aria-label="New stage type"
          placeholder="New stage type"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // don't submit the project form
              addType()
            }
          }}
        />
        <button type="button" onClick={addType} disabled={!newName.trim()}>
          Add
        </button>
      </div>
      {createStageType.error && <p className="error">{createStageType.error.message}</p>}
    </fieldset>
  )
}
