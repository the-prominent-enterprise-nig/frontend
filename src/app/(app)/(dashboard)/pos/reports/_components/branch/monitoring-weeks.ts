/**
 * Scenario 85 Part 6 — the client's sheet splits a month into 8-day weeks:
 * Week 1 is days 1–8, Week 2 days 9–16, and so on, the last one short.
 */

export const WEEK_LENGTH = 8

export interface MonitoringWeek {
  number: number
  /** 0-based indexes into a row's `daily` array. */
  dayIndexes: number[]
  label: string
}

export function monitoringWeeks(daysElapsed: number): MonitoringWeek[] {
  const weeks: MonitoringWeek[] = []
  for (let start = 0; start < daysElapsed; start += WEEK_LENGTH) {
    const dayIndexes = Array.from(
      { length: Math.min(WEEK_LENGTH, daysElapsed - start) },
      (_, i) => start + i
    )
    const number = weeks.length + 1
    weeks.push({
      number,
      dayIndexes,
      label: `Week ${number} (${start + 1}–${start + dayIndexes.length})`,
    })
  }
  return weeks
}
