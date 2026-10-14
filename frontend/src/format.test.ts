import { describe, expect, it } from 'vitest'

import { dispatchText } from './format'

describe('dispatchText', () => {
  it('counts down to dispatch', () => {
    expect(dispatchText(12)).toBe('Dispatch in 12 days')
    expect(dispatchText(1)).toBe('Dispatch in 1 day')
  })

  it('handles today, overdue and missing dates', () => {
    expect(dispatchText(0)).toBe('Dispatch today')
    expect(dispatchText(-3)).toBe('Dispatch 3 days overdue')
    expect(dispatchText(null)).toBe('No dispatch date')
  })
})
