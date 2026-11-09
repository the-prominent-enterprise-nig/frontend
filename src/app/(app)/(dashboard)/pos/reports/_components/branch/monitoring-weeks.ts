import { shortDay } from './scorecard-format'

/**
 * Scenario 85 Part 6 — the client's sheet splits a month into 8-day weeks:
 * Week 1 is days 1–8, Week 2 days 9–16, and so on, the last one short. Any
 * From–To period is split the same way from its first day.
 */

export const WEEK_LENGTH = 8

export interface MonitoringWeek {
  number: number
  /** 0-based indexes into a row's `daily` array. */
  dayIndexes: number[]
  label: string
}

/** `days`: the period's days in order, 'YYYY-MM-DD' — any row's `daily`. */
export function monitoringWeeks(days: string[]): MonitoringWeek[] {
  const weeks: MonitoringWeek[] = []
  for (let start = 0; start < days.length; start += WEEK_LENGTH) {
    const dayIndexes = Array.from(
      { length: Math.min(WEEK_LENGTH, days.length - start) },
      (_, i) => start + i
    )
    const number = weeks.length + 1
    const last = days[start + dayIndexes.length - 1]
    weeks.push({
      number,
      dayIndexes,
      label: `Week ${number} (${shortDay(days[start])}–${shortDay(last)})`,
    })
  }
  return weeks
}
