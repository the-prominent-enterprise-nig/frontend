/** Scenario 85 — shared month labels and the month shading ramp. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2025-11' → 'Nov 25' (bar legend). */
export function shortMonth(key: string): string {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`
}

/** '2025-11' → 'Nov 2025' (tooltips). */
export function longMonth(key: string): string {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
}

/**
 * One hue, light → dark: the oldest month is the lightest segment, the newest
 * the darkest. Listed in full so Tailwind keeps every class. 100 is the
 * lightest step that still reads against the white track.
 */
const RAMP = [
  'bg-prominent-purple-100',
  'bg-prominent-purple-200',
  'bg-prominent-purple-300',
  'bg-prominent-purple-400',
  'bg-prominent-purple-500',
  'bg-prominent-purple-600',
  'bg-prominent-purple-700',
  'bg-prominent-purple-800',
  'bg-prominent-purple-900',
]

/** The shade for month `index` of `count`, spread evenly across the ramp. */
export function monthShade(index: number, count: number): string {
  if (count <= 1) return RAMP[RAMP.length - 1]
  return RAMP[Math.round((index * (RAMP.length - 1)) / (count - 1))]
}
