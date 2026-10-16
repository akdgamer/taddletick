import { useState } from 'react'

import { useAddNote, useDeleteNote, useMe, useUpdateNote } from '../api/hooks'
import type { ProjectNote } from '../api/types'
import { initials, timeAgo } from '../format'
import { EditIcon, IconButton, TrashIcon } from './Icons'

interface Props {
  projectId: number
  notes: ProjectNote[]
  canAdd: boolean
  canDelete: boolean // anyone's notes; your own you can always delete
}

/** The project's log: dated notes, newest first. */
export function NotesSection({ projectId, notes, canAdd, canDelete }: Props) {
  const addNote = useAddNote()
  const [draft, setDraft] = useState('')

  const save = () => {
    if (!draft.trim()) return
    addNote.mutate({ projectId, body: draft }, { onSuccess: () => setDraft('') })
  }

  return (
    <details className="tile-section">
      <summary>
        Notes
        {notes.length > 0 && (
          <span className="section-summary">
            {notes.length} · latest {timeAgo(notes[0].created_at)}
          </span>
        )}
      </summary>
      {canAdd && (
        <div className="note-composer">
          <NoteInput
            label="New note"
            value={draft}
            onChange={setDraft}
            onSubmit={save}
            placeholder="What happened? Calls, decisions, changes…"
          />
          <div className="note-composer-actions">
            <span className="muted small">{isMac ? '⌘' : 'Ctrl'} + Enter to save</span>
            <button className="primary" onClick={save} disabled={!draft.trim() || addNote.isPending}>
              Add note
            </button>
          </div>
          {addNote.error && <p className="error">{addNote.error.message}</p>}
        </div>
      )}
      {notes.length === 0 && !canAdd && <p className="muted">No notes yet.</p>}
      {notes.length > 0 && (
        <ol className="note-list">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} canDelete={canDelete} />
          ))}
        </ol>
      )}
    </details>
  )
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

function NoteItem({ note, canDelete }: { note: ProjectNote; canDelete: boolean }) {
  const { data: me } = useMe()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const mine = me !== undefined && note.author?.id === me.id
  const author = note.author?.display_name ?? 'Former user'
  const error = updateNote.error ?? deleteNote.error

  const save = () => {
    if (!draft.trim()) return
    updateNote.mutate({ id: note.id, body: draft }, { onSuccess: () => setEditing(false) })
  }

  return (
    <li className="note">
      <span className="avatar small" aria-hidden>
        {initials(author)}
      </span>
      <div className="note-main">
        <div className="note-head">
          <strong>{author}</strong>
          <time className="muted" dateTime={note.created_at} title={new Date(note.created_at).toLocaleString()}>
            {timeAgo(note.created_at)}
          </time>
          {note.edited_at && <span className="muted">· edited</span>}
          {!editing && (mine || canDelete) && (
            <span className="note-actions">
              {mine && (
                <IconButton
                  label="Edit note"
                  tone="accent"
                  icon={<EditIcon />}
                  onClick={() => {
                    setDraft(note.body)
                    setEditing(true)
                  }}
                />
              )}
              <IconButton
                label="Delete note"
                tone="danger"
                icon={<TrashIcon />}
                onClick={() => deleteNote.mutate(note.id)}
              />
            </span>
          )}
        </div>
        {editing ? (
          <div className="note-composer">
            <NoteInput label="Edit note" value={draft} onChange={setDraft} onSubmit={save} autoFocus />
            <div className="note-composer-actions">
              <button onClick={() => setEditing(false)}>Cancel</button>
              <button className="primary" onClick={save} disabled={!draft.trim() || updateNote.isPending}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="note-body">{note.body}</p>
        )}
        {error && <p className="error">{error.message}</p>}
      </div>
    </li>
  )
}

interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  autoFocus?: boolean
}

function NoteInput({ label, value, onChange, onSubmit, placeholder, autoFocus }: InputProps) {
  return (
    <textarea
      aria-label={label}
      className="note-input"
      rows={2}
      maxLength={5000}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onSubmit()
        }
      }}
    />
  )
}
