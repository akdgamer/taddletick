import { useState } from 'react'

import { useDeleteStage, useUpdateStage } from '../api/hooks'
import type { DashboardStage, StageStatus } from '../api/types'
import { STATUS_LABELS } from '../format'
import { Stakeholders } from './Stakeholders'

export function StageRow({ stage }: { stage: DashboardStage }) {
  const updateStage = useUpdateStage()
  const deleteStage = useDeleteStage()
  const [notes, setNotes] = useState(stage.notes)

  const update = (body: Parameters<typeof updateStage.mutate>[0]['body']) =>
    updateStage.mutate({ id: stage.id, body })

  return (
    <li className={`stage flag-${stage.flag} status-${stage.status}`}>
      <span className="stage-marker" aria-hidden />
      <span className="stage-name">{stage.name}</span>

      <select
        aria-label={`${stage.name} status`}
        value={stage.status}
        onChange={(e) => update({ status: e.target.value as StageStatus })}
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <input
        type="date"
        aria-label={`${stage.name} due date`}
        value={stage.due_date ?? ''}
        onChange={(e) => update({ due_date: e.target.value || null })}
      />

      <input
        className="stage-notes"
        aria-label={`${stage.name} notes`}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        // Save when leaving the field, not on every keystroke
        onBlur={() => notes !== stage.notes && update({ notes })}
      />

      <button
        className="icon-button"
        aria-label={`Remove ${stage.name}`}
        title="Remove stage"
        onClick={() => deleteStage.mutate(stage.id)}
      >
        ×
      </button>

      {/* Finished stages with nobody attached don't need a people row */}
      {(stage.status !== 'done' || stage.contacts.length > 0) && (
        <Stakeholders stageId={stage.id} stageName={stage.name} contacts={stage.contacts} />
      )}
    </li>
  )
}
