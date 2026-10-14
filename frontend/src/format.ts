import type { StageStatus } from './api/types'

export const STATUS_LABELS: Record<StageStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

export function dispatchText(days: number | null): string {
  if (days === null) return 'No dispatch date'
  if (days === 0) return 'Dispatch today'
  if (days < 0) return `Dispatch ${plural(-days, 'day')} overdue`
  return `Dispatch in ${plural(days, 'day')}`
}

export function formatDate(iso: string): string {
  // Parse as a local date; new Date("2026-03-10") would be read as UTC midnight
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
