import { useEffect, useRef } from 'react'

/**
 * Requests from the command palette to whichever page is showing,
 * e.g. "open the new-project form" or "show project 7".
 */
export type Command =
  | { type: 'new-project' }
  | { type: 'new-task' }
  | { type: 'show-project'; id: number }
  | { type: 'search-contacts'; q: string }

const EVENT = 'taddletick:command'

// Fired after the page switch so the target page has mounted and can listen
export function sendCommand(command: Command) {
  setTimeout(() => window.dispatchEvent(new CustomEvent<Command>(EVENT, { detail: command })), 0)
}

export function useCommand(handle: (command: Command) => void) {
  // Latest handler without re-subscribing on every render
  const ref = useRef(handle)
  useEffect(() => {
    ref.current = handle
  })
  useEffect(() => {
    const listener = (e: Event) => ref.current((e as CustomEvent<Command>).detail)
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [])
}

/** Scroll a project tile into view and pulse it so the eye finds it */
export function revealProject(id: number) {
  const tile = document.getElementById(`project-${id}`)
  if (!tile) return
  tile.scrollIntoView({ behavior: 'smooth', block: 'center' })
  tile.classList.remove('tile-flash')
  void tile.offsetWidth // restart the animation if it is already flashing
  tile.classList.add('tile-flash')
  tile.addEventListener('animationend', () => tile.classList.remove('tile-flash'), { once: true })
}
