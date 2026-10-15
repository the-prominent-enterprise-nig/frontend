'use client'

const pagerButtonClass =
  'rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-[6px] text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:border-[#e4e4e9] disabled:text-[#a3a3b2]'

/**
 * The footer bar the Stock Transactions tables share (Stock Transfer's
 * layout): the result count always, Previous · page / pages · Next once there
 * is a second page. Sits inside the table's card, under the rows.
 */
export function ListFooterPager({
  page,
  pageCount,
  shown,
  total,
  noun,
  onPageChange,
}: {
  page: number
  pageCount: number
  /** Rows on this page. */
  shown: number
  total: number
  /** Plural, e.g. "delivery receipts". */
  noun: string
  onPageChange: (page: number) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-[18px] py-[11px]">
      <span className="text-[11.5px] text-[#5b5b6b]">
        Showing {shown} of {total} {noun}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={pagerButtonClass}
          >
            Previous
          </button>
          <span className="px-2 text-[12px] font-medium text-[#3d3d4a]">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className={pagerButtonClass}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
