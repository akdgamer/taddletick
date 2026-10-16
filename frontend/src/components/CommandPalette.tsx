import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useCan, useContacts, useDashboard } from '../api/hooks'
import { sendCommand, type Command } from '../commands'

export type PageName = 'projects' | 'calendar' | 'tasks' | 'contacts' | 'activity' | 'users' | 'settings'

interface Item {
  id: string
  group: 'Go to' | 'Create' | 'Projects' | 'Contacts'
  label: string
  hint?: string
  page: PageName
  command?: Command
}

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (page: PageName) => void
}

/** ⌘K: jump to a page, project or person, or start something new, from the keyboard. */
export function CommandPalette({ open, onClose, onNavigate }: Props) {
  if (!open) return null
  return <Palette onClose={onClose} onNavigate={onNavigate} />
}

function Palette({ onClose, onNavigate }: Omit<Props, 'open'>) {
  const { data: projects = [] } = useDashboard()
  const { data: contacts = [] } = useContacts()
  const isAdmin = useCan('is_admin')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { id: 'p-projects', group: 'Go to', label: 'Projects', page: 'projects' },
      { id: 'p-calendar', group: 'Go to', label: 'Calendar', hint: 'Deadlines by month', page: 'calendar' },
      { id: 'p-tasks', group: 'Go to', label: 'Tasks', page: 'tasks' },
      { id: 'p-contacts', group: 'Go to', label: 'Contacts', page: 'contacts' },
      { id: 'p-activity', group: 'Go to', label: 'Activity', hint: 'Recent changes', page: 'activity' },
      ...(isAdmin ? [{ id: 'p-users', group: 'Go to', label: 'Users', page: 'users' } as Item] : []),
      { id: 'p-settings', group: 'Go to', label: 'Settings', hint: 'Google sync, password', page: 'settings' },
    ]
    const create: Item[] = [
      { id: 'c-project', group: 'Create', label: 'New project', page: 'projects', command: { type: 'new-project' } },
      { id: 'c-task', group: 'Create', label: 'New task', page: 'tasks', command: { type: 'new-task' } },
    ]
    const projectItems: Item[] = projects.map((p) => ({
      id: `project-${p.id}`,
      group: 'Projects',
      label: p.name,
      hint: [p.client?.name, p.po_number && `PO ${p.po_number}`].filter(Boolean).join(' · '),
      page: 'projects',
      command: { type: 'show-project', id: p.id },
    }))
    const contactItems: Item[] = contacts.map((c) => ({
      id: `contact-${c.id}`,
      group: 'Contacts',
      label: c.name,
      hint: [c.role, c.client?.name].filter(Boolean).join(' · '),
      page: 'contacts',
      command: { type: 'search-contacts', q: c.name },
    }))
    return [...pages, ...create, ...projectItems, ...contactItems]
  }, [projects, contacts, isAdmin])

  const results = useMemo(() => filter(items, query), [items, query])

  // Keep the highlighted row on screen while arrowing through
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (item: Item) => {
    onClose()
    onNavigate(item.page)
    if (item.command) sendCommand(item.command)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = ''
  const rows: ReactNode[] = []
  results.forEach((item, i) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group
      rows.push(
        <li key={`g-${item.group}`} className="palette-group" role="presentation">
          {item.group}
        </li>,
      )
    }
    rows.push(
      <li
        key={item.id}
        role="option"
        aria-selected={i === active}
        className="palette-item"
        onPointerMove={() => setActive(i)}
        onClick={() => choose(item)}
      >
        <span className="palette-label">{item.label}</span>
        {item.hint && <span className="palette-hint">{item.hint}</span>}
        {i === active && (
          <kbd className="palette-enter" aria-hidden>
            ↵
          </kbd>
        )}
      </li>,
    )
  })

  return (
    <div className="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Search and commands">
        <div className="palette-input">
          <SearchIcon />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-label="Search projects, contacts and pages"
            placeholder="Search projects, contacts, pages…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" ref={list} className="palette-results">
          {rows}
          {results.length === 0 && <li className="palette-empty">Nothing matches “{query}”</li>}
        </ul>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
        </div>
      </div>
    </div>
  )
}

/** Every typed word must appear somewhere; names that start with the query come first. */
function filter(items: Item[], query: string): Item[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return items.filter((i) => i.group === 'Go to' || i.group === 'Create' || i.group === 'Projects')
  const scored = items
    .map((item) => {
      const label = item.label.toLowerCase()
      const text = `${label} ${item.hint ?? ''} ${item.group}`.toLowerCase()
      if (!words.every((w) => text.includes(w))) return null
      const score = label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2
      return { item, score }
    })
    .filter((x): x is { item: Item; score: number } => x !== null)
  // Stable within a group, so results stay grouped
  const order = ['Go to', 'Create', 'Projects', 'Contacts']
  return scored
    .sort((a, b) => order.indexOf(a.item.group) - order.indexOf(b.item.group) || a.score - b.score)
    .map((x) => x.item)
    .slice(0, 30)
}

export function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
