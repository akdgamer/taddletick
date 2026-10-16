import { useEffect, useId, useRef, useState } from 'react'

import { useCan, useCreateStageType, useStageTypes } from '../api/hooks'
import type { StageType } from '../api/types'
import { findSameName, searchStages } from '../stageSearch'
import { SearchIcon } from './CommandPalette'

interface Props {
  /** Stages already chosen (on the project, or ticked in the form): not offered again */
  exclude: number[]
  onPick: (type: StageType) => void
  /** What the closed button says */
  label: string
  /** Shown while saving after a pick on a project card */
  busy?: boolean
}

const SHOWN = 50 // rows rendered at once; typing narrows it down

/**
 * Searchable stage picker: type to filter hundreds of stages, with typo-tolerant matching.
 * When nothing matches exactly it offers to create the stage, warning first about similar names.
 */
export function StageSearch({ exclude, onPick, label, busy = false }: Props) {
  const { data: types = [] } = useStageTypes()
  const createType = useCreateStageType()
  const canCreate = useCan('can_edit')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()

  const available = types.filter((t) => !exclude.includes(t.id))
  const results = searchStages(available, query)
  const trimmed = query.trim()
  const sameName = trimmed ? findSameName(types, trimmed) : undefined
  const alreadyChosen = sameName && exclude.includes(sameName.id) ? sameName : undefined
  // Offer "Create" only for a name that doesn't exist under any spelling
  const offerCreate = canCreate && trimmed !== '' && !sameName
  const options: ({ kind: 'pick'; type: StageType } | { kind: 'create' })[] = [
    ...results.slice(0, SHOWN).map((type) => ({ kind: 'pick' as const, type })),
    ...(offerCreate ? [{ kind: 'create' as const }] : []),
  ]

  const close = () => {
    setOpen(false)
    setQuery('')
    setActive(0)
    createType.reset()
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close()
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  })

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (option: (typeof options)[number] | undefined) => {
    if (!option) return
    if (option.kind === 'pick') {
      onPick(option.type)
      close()
    } else {
      createType.mutate(trimmed, {
        onSuccess: (created) => {
          onPick(created)
          close()
        },
      })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault() // never submit the surrounding form
      choose(options[active])
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
  }

  if (!open) {
    return (
      <button type="button" className="ghost-select stage-search-trigger" onClick={() => setOpen(true)} disabled={busy}>
        {busy ? 'Adding…' : label}
      </button>
    )
  }

  const similar = offerCreate ? results.slice(0, 3) : []

  return (
    <div className="stage-search" ref={root}>
      <div className="stage-search-input">
        <SearchIcon />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-label="Search stages"
          placeholder={canCreate ? 'Search or create a stage…' : 'Search stages…'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul className="stage-search-list" role="listbox" id={listId} ref={list}>
        {!trimmed && available.length > SHOWN && (
          <li className="stage-search-hint" role="presentation">
            {available.length} stages. Type to narrow down.
          </li>
        )}
        {options.map((o, i) =>
          o.kind === 'pick' ? (
            <li
              key={o.type.id}
              role="option"
              aria-selected={i === active}
              className="stage-search-option"
              onPointerMove={() => setActive(i)}
              onClick={() => choose(o)}
            >
              {o.type.name}
            </li>
          ) : (
            <li key="create" role="presentation" className="stage-search-create-group">
              {similar.length > 0 && (
                <p className="stage-search-warning">
                  Similar stages already exist: {similar.map((t) => t.name).join(', ')}. Pick one above if it's the same
                  thing.
                </p>
              )}
              <div
                role="option"
                aria-selected={i === active}
                className="stage-search-option create"
                onPointerMove={() => setActive(i)}
                onClick={() => choose(o)}
              >
                + Create “{trimmed}”
              </div>
            </li>
          ),
        )}
        {alreadyChosen && (
          <li className="stage-search-hint" role="presentation">
            “{alreadyChosen.name}” is already added.
          </li>
        )}
        {options.length === 0 && !alreadyChosen && (
          <li className="stage-search-hint" role="presentation">
            {trimmed ? 'No matching stages.' : 'Every stage is already added.'}
          </li>
        )}
      </ul>
      {createType.isPending && <p className="stage-search-hint">Creating…</p>}
      {createType.error && <p className="error">{createType.error.message}</p>}
    </div>
  )
}
