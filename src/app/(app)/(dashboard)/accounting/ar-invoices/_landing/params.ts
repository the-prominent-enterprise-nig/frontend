// Pure (no imports): read by the Server Component that parses the URL and the
// client filter bar that writes it.

export const PER_PAGE = 50

export type RawSearchParams = { q?: string; page?: string }

export interface LandingParams {
  /** Invoice # or POS transaction # (the backend resolves either). */
  search?: string
  page: number
}

export function parseLandingParams(raw: RawSearchParams): LandingParams {
  const page = Number.parseInt(raw.page ?? '', 10)
  return {
    search: raw.q?.trim() || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
