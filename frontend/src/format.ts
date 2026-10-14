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
