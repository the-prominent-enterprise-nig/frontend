// Pure (no imports): read by the Server Components that parse the URL and the
// client controls that write it.

/**
 * How many account rows a page may carry, counting whole branches (a branch is
 * never split across pages). The cost of the page is the rows on it — one
 * branch has 130 accounts, another 2,500 — so pages are packed by rows instead
 * of a fixed number of branches: the previous 10-branch pages held 6,000+ rows
 * (~21 MB of HTML on top of the same data again in the RSC payload). A branch
 * larger than the budget still gets a page to itself. Raise it for fewer, longer
 * pages.
 */
export const ROWS_PER_PAGE_BUDGET = 2500

/** The earlier rule still holds as an upper bound: never more than this many branches on a page. */
export const MAX_BRANCHES_PER_PAGE = 10

/** What the backend filters on; every key is optional and sent only when set. */
export interface AgingFilters {
  asOf: string
  branchId?: string
  collectorId?: string
  supervisorName?: string
}

export interface AgingParams extends AgingFilters {
  page: number
}

export type RawSearchParams = {
  asOf?: string
  branchId?: string
  collectorId?: string
  supervisorName?: string
  page?: string
}

/** Today's date in Manila (YYYY-MM-DD) — the business day, not the server's UTC day. */
export function todayInManila(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parseAgingParams(raw: RawSearchParams): AgingParams {
  const page = Number.parseInt(raw.page ?? '', 10)
  return {
    asOf: raw.asOf && DATE_ONLY.test(raw.asOf) ? raw.asOf : todayInManila(),
    branchId: raw.branchId || undefined,
    collectorId: raw.collectorId || undefined,
    supervisorName: raw.supervisorName || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** The filter part of the params, without paging. */
export function agingFilters(params: AgingParams): AgingFilters {
  return {
    asOf: params.asOf,
    branchId: params.branchId,
    collectorId: params.collectorId,
    supervisorName: params.supervisorName,
  }
}
