// Pure (no imports): shared by the Server Components that read the URL and the
// client controls that write it, without pulling data-fetching code into the
// browser bundle.

export const DAY_OPTIONS = [7, 14, 30, 60, 90] as const
export type DayOption = (typeof DAY_OPTIONS)[number]
export const DEFAULT_DAYS: DayOption = 30
export const PER_PAGE = 50

export interface ProjectionParams {
  days: DayOption
  warehouseId?: string
  page: number
}

export type RawSearchParams = { days?: string; warehouseId?: string; page?: string }

/** Anything unrecognised falls back to the default instead of erroring. */
export function parseProjectionParams(raw: RawSearchParams): ProjectionParams {
  const days = Number(raw.days)
  const page = Number.parseInt(raw.page ?? '', 10)
  return {
    days: (DAY_OPTIONS as readonly number[]).includes(days) ? (days as DayOption) : DEFAULT_DAYS,
    warehouseId: raw.warehouseId || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
