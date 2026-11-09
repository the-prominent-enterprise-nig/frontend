'use client'

import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { CONTROL_CHROME } from '@/src/libs/design/plex'

/** Rows-per-page choices every Stock Transactions table offers. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
/** Rows-per-page choices the Stock Ledger tables offer (they open on 20). */
export const STOCK_LEDGER_PAGE_SIZES = [20, 50, 100] as const

function rowOptions(sizes: readonly number[]): { value: string; label: string }[] {
  return sizes.map((n) => ({ value: String(n), label: String(n) }))
}

const pagerButtonClass =
  'rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-[6px] text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:border-[#e4e4e9] disabled:text-ink-faint'

type Props = {
  page: number
  pageCount: number
  total: number
  /** Rows per page — the range ("Showing 26–50") is worked out from it. */
  limit: number
  /** Plural, e.g. "delivery receipts". */
  noun: string
  onPageChange: (page: number) => void
  /** Shows the Rows picker. A new size should send the list back to page 1. */
  onLimitChange?: (limit: number) => void
  /** Replaces the "Showing 1–25 of N noun" text, e.g. to add a note after it. */
  summary?: React.ReactNode
  /** Rows picker choices — PAGE_SIZE_OPTIONS unless a screen opens on another size. */
  pageSizes?: readonly number[]
  /** The "2 / 5" page counter. The Stock Ledger tables (Stock Balance's layout) leave it out. */
  showPageNumber?: boolean
}

function rangeText(page: number, limit: number, total: number, noun: string): string {
  if (total === 0) return `No ${noun} yet`
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return `Showing ${from}–${to} of ${total} ${noun}`
}

/**
 * The footer bar every Stock Transactions table shares (the Purchase Order
 * table's layout): the range, a Rows picker, the page, and Previous / Next —
 * always shown, greyed at either end. Sits inside the table's card, under the
 * rows.
 */
export function ListFooterPager({
  page,
  pageCount,
  total,
  limit,
  noun,
  onPageChange,
  onLimitChange,
  summary,
  pageSizes = PAGE_SIZE_OPTIONS,
  showPageNumber = true,
}: Props): React.JSX.Element {
  const pages = Math.max(1, pageCount)
  return (
    <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
      <span className="text-[11.5px] text-ink-muted">
        {summary ?? rangeText(page, limit, total, noun)}
      </span>
      <div className="flex items-center gap-[10px]">
        {onLimitChange && (
          <>
            <span className="text-[11.5px] text-ink-muted">Rows</span>
            <SearchableSelect
              className="w-[84px]"
              value={String(limit)}
              onChange={(v) => v && onLimitChange(Number(v))}
              options={rowOptions(pageSizes)}
              ariaLabel="Rows per page"
              chrome={CONTROL_CHROME}
              inputMode="numeric"
              portal
            />
          </>
        )}
        {showPageNumber && (
          <span className="text-[12px] font-medium text-[#3d3d4a]">
            {page} / {pages}
          </span>
        )}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={pagerButtonClass}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className={pagerButtonClass}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
