// Pure paging helpers shared by Server Components (which compute the page) and
// <UrlPagination> (which draws the controls).

export interface PageInfo {
  /** 1-based, clamped into range. */
  page: number
  pageCount: number
  /** Index of the first item on this page, 0-based. */
  pageStart: number
  /** How many items this page renders. */
  pageSize: number
  totalItems: number
}

/** Fixed-size pages: `perPage` items each. */
export function fixedPages(page: number, perPage: number, totalItems: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(totalItems / perPage))
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const pageStart = (safePage - 1) * perPage
  return {
    page: safePage,
    pageCount,
    pageStart,
    pageSize: Math.min(perPage, Math.max(totalItems - pageStart, 0)),
    totalItems,
  }
}

/**
 * Pages bounded by weight rather than by count: items are packed in order until
 * adding the next would exceed `budget` (or the page already holds `maxItems`).
 * An item heavier than the budget gets a page to itself. Use when items vary a
 * lot in size (a branch with 130 accounts next to one with 2,500) and the cost
 * of a page is the total weight on it.
 */
export function weightedPages<T>(
  items: readonly T[],
  weight: (item: T) => number,
  budget: number,
  maxItems = Number.POSITIVE_INFINITY
): T[][] {
  const pages: T[][] = []
  let current: T[] = []
  let used = 0
  for (const item of items) {
    const w = weight(item)
    if (current.length > 0 && (used + w > budget || current.length >= maxItems)) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(item)
    used += w
  }
  if (current.length > 0) pages.push(current)
  return pages
}

/** PageInfo for pages produced by weightedPages(). */
export function weightedPageInfo<T>(pages: readonly T[][], page: number): PageInfo {
  const pageCount = Math.max(1, pages.length)
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const totalItems = pages.reduce((sum, p) => sum + p.length, 0)
  const pageStart = pages.slice(0, safePage - 1).reduce((sum, p) => sum + p.length, 0)
  return {
    page: safePage,
    pageCount,
    pageStart,
    pageSize: pages[safePage - 1]?.length ?? 0,
    totalItems,
  }
}
