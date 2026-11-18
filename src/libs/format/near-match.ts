/** Lowercase letters and digits only, with a trailing plural "s" dropped, so
 * "Air-Con", "aircon" and "Aircons" compare equal. */
function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.{3,})s$/, '$1')
}

/** Edits to turn a into b — insert, delete, replace, or swap two neighbours
 * ("KOLNI" → "KOLIN" is one). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** How close a label is to the typed text — lower is closer, null is not close. */
function closeness(typed: string, label: string): number | null {
  const s = squash(label)
  if (!s) return null
  if (s === typed) return 0
  if (s.length >= 3 && (s.includes(typed) || typed.includes(s))) return 1
  const allowed = typed.length <= 4 ? 1 : 2
  const distance = editDistance(typed, s)
  return distance <= allowed ? distance + 1 : null
}

/**
 * Options whose label looks like a slip of what was typed — a typo, swapped
 * letters, a plural, different spacing or punctuation. Closest first.
 */
export function nearMatches<T extends { label: string }>(
  typed: string,
  options: T[],
  limit = 3
): T[] {
  const t = squash(typed)
  if (t.length < 2) return []
  return options
    .map((option) => ({ option, score: closeness(t, option.label) }))
    .filter((m): m is { option: T; score: number } => m.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((m) => m.option)
}
