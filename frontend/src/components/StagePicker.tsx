import { useStageTypes } from '../api/hooks'
import { IconButton, XIcon } from './Icons'
import { StageSearch } from './StageSearch'

interface Props {
  selected: number[]
  onChange: (ids: number[]) => void
}

/** The new project's stages: chosen ones as chips, plus a search to add more (or create one). */
export function StagePicker({ selected, onChange }: Props) {
  const { data: stageTypes = [] } = useStageTypes()
  // Show them in catalog order, the order they'll have on the project
  const chosen = stageTypes.filter((t) => selected.includes(t.id))

  return (
    <fieldset className="stage-picker">
      <legend>Stages</legend>
      {chosen.length > 0 && (
        <ul className="stage-chips">
          {chosen.map((t) => (
            <li key={t.id} className="stage-chip">
              {t.name}
              <IconButton
                label={`Remove ${t.name}`}
                icon={<XIcon />}
                onClick={() => onChange(selected.filter((id) => id !== t.id))}
              />
            </li>
          ))}
        </ul>
      )}
      <StageSearch
        exclude={selected}
        label={chosen.length ? '+ Add another stage' : '+ Add stages'}
        onPick={(t) => onChange([...selected, t.id])}
      />
    </fieldset>
  )
}
