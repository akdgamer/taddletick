import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** Accessible name of the button that opens the menu */
  label: string
  /** What the button shows (defaults to a "more" icon) */
  trigger?: ReactNode
  triggerClassName?: string
  /** Menu contents; call close() after an item has done its job */
  children: (close: () => void) => ReactNode
}

/** A small dropdown: closes on outside click, Escape, or when an item calls close(). */
export function Menu({ label, trigger, triggerClassName = 'icon-button', children }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={root}>
      <button
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger ?? <MoreIcon />}
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`chevron${open ? ' open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 2.5 7.5 6 4 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
