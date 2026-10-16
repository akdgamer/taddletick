import { describe, expect, it } from 'vitest'

import type { StageType } from './api/types'
import { findSameName, matchScore, searchStages } from './stageSearch'

const types: StageType[] = [
  'PO received',
  'Electrical design',
  'Structural design',
  'Software',
  'Testing & QA',
  'Design',
].map((name, i) => ({ id: i + 1, name, sort_order: i }))

const names = (q: string) => searchStages(types, q).map((t) => t.name)

describe('stage search', () => {
  it('finds names by their start or any word start, best first', () => {
    expect(names('design')).toEqual(['Design', 'Electrical design', 'Structural design'])
    expect(names('elec')).toEqual(['Electrical design'])
    expect(names('qa')).toEqual(['Testing & QA'])
  })

  it('forgives small typos but not unrelated words', () => {
    expect(names('eletrical')).toEqual(['Electrical design'])
    expect(names('sofware')).toEqual(['Software'])
    expect(names('wiring')).toEqual([])
    expect(matchScore('xyz', 'Design')).toBeNull()
  })

  it('treats case, spacing and punctuation as the same name', () => {
    expect(findSameName(types, '  electrical   DESIGN ')?.id).toBe(2)
    expect(findSameName(types, 'testing qa')?.name).toBe('Testing & QA')
    expect(findSameName(types, 'Electrical')).toBeUndefined()
  })
})
