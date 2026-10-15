import { useState } from 'react'

import { useDeleteStage, useUpdateStage } from '../api/hooks'
import type { DashboardStage, StageStatus } from '../api/types'
import { dueText, STATUS_LABELS } from '../format'
import { ChevronIcon } from './Menu'
import { Stakeholders } from './Stakeholders'

interface Props {
  stage: DashboardStage
  canEdit: boolean
  canDelete: boolean
}

/**
 * One stage: a compact line (status, name, due) that opens into the details
 * (date, notes, people). Status changes right from the line, being the most common edit.
 */
export function StageRow({ stage, canEdit, canDelete }: Props) {
  const updateStage = useUpdateStage()
  const deleteStage = useDeleteStage()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(stage.notes)

  const update = (body: Parameters<typeof updateStage.mutate>[0]['body']) =>
    updateStage.mutate({ id: stage.id, body })
  const showDue = stage.due_date && stage.status !== 'done'
  const error = updateStage.error ?? deleteStage.error

  return (
    <li className={`stage flag-${stage.flag} status-${stage.status}${open ? ' open' : ''}`}>
      <div className="stage-line">
        <StatusSelect
          label={`${stage.name} status`}
          value={stage.status}
          disabled={!canEdit}
          onChange={(status) => update({ status })}
        />
        <button className="stage-name" aria-expanded={open} onClick={() => setOpen(!open)}>
          {stage.name}
        </button>
        {/* Always rendered so every row's columns line up */}
        <span className={`stage-due flag-${stage.flag}`}>{showDue && dueText(stage.due_date!)}</span>
        <button
          className="icon-button stage-toggle"
          aria-label={`${open ? 'Hide' : 'Show'} details of ${stage.name}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronIcon open={open} />
        </button>
      </div>

      {!open && (stage.notes || stage.contacts.length > 0) && (
        <p className="stage-summary">
          {stage.notes}
          {stage.notes && stage.contacts.length > 0 && ' · '}
          {stage.contacts.length > 0 && (
            <span className="stage-people">{stage.contacts.map((c) => c.name).join(', ')}</span>
          )}
        </p>
      )}

      {open && (
        <div className="stage-details">
          <div className="form-grid compact">
            <label>
              Due date
              <input
                type="date"
                aria-label={`${stage.name} due date`}
                disabled={!canEdit}
                value={stage.due_date ?? ''}
                onChange={(e) => update({ due_date: e.target.value || null })}
              />
            </label>
            <label className="span-2">
              Notes
              <input
                aria-label={`${stage.name} notes`}
                readOnly={!canEdit}
                placeholder={canEdit ? 'What is happening, what is it waiting on…' : ''}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                // Save when leaving the field, not on every keystroke
                onBlur={() => notes !== stage.notes && update({ notes })}
              />
            </label>
          </div>
          <div className="field">
            <span>People</span>
            <Stakeholders stageId={stage.id} stageName={stage.name} contacts={stage.contacts} readOnly={!canEdit} />
          </div>
          {canDelete && (
            <div className="stage-details-actions">
              <button className="text-button danger-text" onClick={() => deleteStage.mutate(stage.id)}>
                Remove stage
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
    </li>
  )
}

interface StatusSelectProps {
  label: string
  value: StageStatus
  disabled: boolean
  onChange: (status: StageStatus) => void
}

/** A select that looks like a status pill */
function StatusSelect({ label, value, disabled, onChange }: StatusSelectProps) {
  return (
    <select
      className={`status-pill status-${value}`}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as StageStatus)}
    >
      {Object.entries(STATUS_LABELS).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}
