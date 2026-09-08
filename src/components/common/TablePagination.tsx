'use client'

interface Props {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Index of the first item on this page, 0-based. */
  pageStart: number
  /** How many items this page actually renders. */
  pageSize: number
  totalItems: number
  /** What is being counted, e.g. "group" / "branch". Pluralised with an "s". */
  noun: string
}

/**
 * Shared pager for the Scenario 47 report tables. Client-side: it bounds what
 * is *rendered*, not what is fetched — the totals and the Excel export always
 * cover the whole result, so paging can never change a number.
 *
 * The controls are a labelled <nav> because "Next"/"Previous" are common words
 * on these pages; without it the buttons are ambiguous to a screen reader (and
 * to a test locator).
 */
export default function TablePagination({
  page,
  pageCount,
  onPageChange,
  pageStart,
  pageSize,
  totalItems,
  noun,
}: Props): React.JSX.Element {
  const shownTo = Math.min(pageStart + pageSize, totalItems)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-gray-500">
        Showing {pageStart + 1}–{shownTo} of {totalItems} {noun}
        {totalItems === 1 ? '' : 's'}
      </p>

      {/* No controls at all when everything fits — a disabled pager on a
          single-page result is just noise. */}
      {pageCount > 1 && (
        <nav aria-label="Table pagination" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-gray-600 tabular-nums">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
