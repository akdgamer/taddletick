import { describe, expect, it } from 'vitest'

import { daysFrom, dueText, relativeDays } from './format'

describe('relativeDays', () => {
  it('counts down, then up once overdue', () => {
    expect(relativeDays(12)).toBe('in 12 days')
    expect(relativeDays(1)).toBe('in 1 day')
    expect(relativeDays(0)).toBe('today')
    expect(relativeDays(-3)).toBe('3 days overdue')
  })
})

describe('daysFrom', () => {
  it('counts whole calendar days, across month ends', () => {
    expect(daysFrom('2026-03-01', '2026-02-27')).toBe(2)
    expect(daysFrom('2026-02-20', '2026-03-01')).toBe(-9)
    expect(daysFrom('2026-03-01', '2026-03-01')).toBe(0)
  })
})

describe('dueText', () => {
  it('says how late, or when', () => {
    const today = new Date()
    const iso = (offset: number) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    expect(dueText(iso(-2))).toBe('2 days late')
    expect(dueText(iso(0))).toBe('Due today')
    expect(dueText(iso(5))).toMatch(/^Due /)
  })
})
