import type { StageStatus } from './api/types'

export const STATUS_LABELS: Record<StageStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

/** "in 12 days", "today", "3 days overdue": how far away a deadline is */
export function relativeDays(days: number): string {
  if (days === 0) return 'today'
  if (days < 0) return `${plural(-days, 'day')} overdue`
  return `in ${plural(days, 'day')}`
}

export function formatDate(iso: string): string {
  // Parse as a local date; new Date("2026-03-10") would be read as UTC midnight
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "13 Oct", or "13 Oct 2027" when it isn't this year: for compact rows */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const sameYear = y === new Date().getFullYear()
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Whole days from today to an ISO date (negative = in the past). Display only; flags come from the API. */
export function daysFrom(iso: string, today = todayIso()): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(iso) - toUtc(today)) / 86_400_000)
}

/** "Due 19 Oct", "Due today", "2 days late" */
export function dueText(iso: string): string {
  const days = daysFrom(iso)
  if (days < 0) return `${plural(-days, 'day')} late`
  if (days === 0) return 'Due today'
  return `Due ${shortDate(iso)}`
}

/** "just now", "5 minutes ago", "3 hours ago", then the date */
export function timeAgo(isoDateTime: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(isoDateTime).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  return new Date(isoDateTime).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
