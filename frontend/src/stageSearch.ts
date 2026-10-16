import type { StageType } from './api/types'

/** "  Electrical   Design " -> "electrical design" (case, spacing and punctuation don't count) */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Edit distance, for catching typos like "eletrical" */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const typoAllowance = (length: number) => (length <= 3 ? 0 : length <= 6 ? 1 : 2)

/**
 * How well a stage name matches what was typed; lower is better, null is no match.
 * 0 same name, 1 starts with it, 2 every typed word starts a word in the name,
 * 3 appears inside, 4 close enough to be a typo.
 */
export function matchScore(query: string, name: string): number | null {
  const q = normalize(query)
  const n = normalize(name)
  if (!q) return 2
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  const words = n.split(' ')
  if (q.split(' ').every((qw) => words.some((w) => w.startsWith(qw)))) return 2
  if (n.includes(q)) return 3
  // Typos: compare with the whole name, and with runs of words as long as the query
  const qWords = q.split(' ').length
  const candidates = [n]
  for (let i = 0; i + qWords <= words.length; i++) candidates.push(words.slice(i, i + qWords).join(' '))
  const allowance = typoAllowance(q.length)
  if (allowance && candidates.some((c) => distance(q, c) <= allowance)) return 4
  return null
}

/** Matching stages, best first, then in the catalog's usual order */
export function searchStages(types: StageType[], query: string): StageType[] {
  return types
    .map((t) => ({ t, score: matchScore(query, t.name) }))
    .filter((x): x is { t: StageType; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || a.t.sort_order - b.t.sort_order || a.t.id - b.t.id)
    .map((x) => x.t)
}

/** The existing stage with this exact name (ignoring case and spacing), if any */
export const findSameName = (types: StageType[], name: string) =>
  types.find((t) => normalize(t.name) === normalize(name))
