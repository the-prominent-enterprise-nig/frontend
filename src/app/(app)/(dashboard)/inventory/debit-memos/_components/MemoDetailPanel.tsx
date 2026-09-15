'use client'

import type { ReactNode } from 'react'
import { fmtMoney, type SupplierDebitMemo } from '@/src/libs/data/AccountingV2Data'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { MONO } from '@/src/libs/design/plex'

// Inventory's own reading of a memo, under its row: where the goods left from,
// what went with them, and every line that makes up the deduction.
//
// Not components/accounting/SupplierDebitMemoDetail, which Accounting's memo
// hub renders — that one keeps the full per-unit price and tax breakdown its
// readers audit against, in the zinc/Poppins language of those screens. This
// says the same things about the same document, in the language of these ones
// and at the altitude a warehouse reads it: what went back, how many, and what
// it took off the invoice.

/** One fact from the memo's head. A missing one is amber rather than grey —
 * "Not recorded" against a delivery receipt is a gap somebody has to close,
 * not a blank worth skipping over. */
function Fact({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}>
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[13px] font-medium ${missing ? 'text-[#8a4b06]' : 'text-[#17171c]'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

export function MemoDetailPanel({
  memo,
  children,
}: {
  memo: SupplierDebitMemo
  /** Rendered under the lines — the list hangs the waybill box here. */
  children?: ReactNode
}) {
  const dr = memo.deliveryReceiptNumber?.trim()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#e4e4e9] bg-white px-4 py-3.5 lg:grid-cols-4">
        <Fact label="Returned from" value={locationLabel(memo.warehouse)} />
        <Fact label="Delivery receipt" value={dr || 'Not recorded'} missing={!dr} />
        <Fact
          label="Supplier invoice"
          value={memo.apBill?.billNumber ?? 'Not yet numbered'}
          missing={!memo.apBill?.billNumber}
        />
        <Fact
          label="Journal entry"
          value={memo.journalEntryId ? 'Posted' : 'Not posted'}
          missing={!memo.journalEntryId}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
        <div
          className={`grid grid-cols-[minmax(0,1fr)_64px_120px] gap-3 border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-2.5 ${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
        >
          <span>Item / reason</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Line total</span>
        </div>
        {(memo.lines ?? []).map((line, index) => {
          // A line with no item is a supplier concession — support,
          // sponsorship, a freight recharge — named by its description, with
          // the account it credits standing in for the SKU underneath.
          const title = line.item?.name ?? line.description ?? 'Supplier concession'
          const sub = line.item
            ? [line.item.sku, line.description, line.account?.name].filter(Boolean).join(' · ')
            : (line.account?.name ?? '')
          return (
            <div
              key={line.id}
              className={`grid grid-cols-[minmax(0,1fr)_64px_120px] items-center gap-3 px-4 py-3 ${
                index ? 'border-t border-[#f4f4f6]' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[#17171c]" title={title}>
                  {title}
                </p>
                {sub && (
                  <p className="mt-0.5 truncate text-[10.5px] text-[#5b5b6b]" title={sub}>
                    {sub}
                  </p>
                )}
              </div>
              <span className={`${MONO} text-right text-[12.5px] tabular-nums text-[#3d3d4a]`}>
                {Number(line.quantity)}
              </span>
              {/* Negative on a support line, which nets off the claim. */}
              <span
                className={`${MONO} whitespace-nowrap text-right text-[12.5px] font-semibold tabular-nums ${
                  line.lineTotal < 0 ? 'text-[#8a4b06]' : 'text-[#17171c]'
                }`}
              >
                {fmtMoney(line.lineTotal)}
              </span>
            </div>
          )
        })}
      </div>

      {memo.reason?.trim() && (
        <div className="rounded-xl border border-[#e4e4e9] bg-white px-4 py-3">
          <p
            className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
          >
            Reason
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#3d3d4a]">{memo.reason}</p>
        </div>
      )}

      {children}
    </div>
  )
}
