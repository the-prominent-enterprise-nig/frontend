'use client'

import { Skeleton } from '@/src/components/ui/Skeleton'

/**
 * Scenario 61 Part 3b — the close screen's one summary card, in the order the
 * client's POS notes ask for: total sales → invoice numbers → cash collected.
 * The cash rows end on what the drawer should hold, which is the figure the
 * cash count beside it has to meet.
 *
 * Sales figures come from /reconciliation (completed sales only, net of
 * refunds); the cash rows are the page's expected-cash build-up.
 */

export interface CashRow {
  key: string
  label: string
  note: string
  amount: number
  strong?: boolean
}

interface Props {
  loading: boolean
  /** False when /reconciliation failed — the cash build-up cannot be shown. */
  loaded: boolean
  netSales: number
  totalRefunds: number
  invoiceNumbers: string[]
  cashRows: CashRow[]
}

export function peso(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SessionSummaryCard(props: Props): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e4e4e9] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4 py-3">
        <span className="text-[13.5px] font-semibold">Session summary</span>
        <span className="text-[11px] text-[#5b5b6b]">System figures — not editable</span>
      </div>
      <SummaryBody {...props} />
    </div>
  )
}

function SummaryBody({
  loading,
  loaded,
  netSales,
  totalRefunds,
  invoiceNumbers,
  cashRows,
}: Props): React.JSX.Element {
  if (loading) {
    return (
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
    )
  }
  if (!loaded) {
    return (
      <p className="px-4 py-3 text-[12.5px] text-[#5b5b6b]">
        Unable to load the session&apos;s figures. Close without them and the variance is still
        computed by the backend — but count carefully, this screen cannot check it for you.
      </p>
    )
  }
  return (
    <>
      <Row
        label="Total sales"
        note={totalRefunds ? `net of ₱${peso(totalRefunds)} refunded` : 'completed sales'}
        amount={netSales}
      />
      <InvoiceList numbers={invoiceNumbers} />
      <div className="border-t border-[#eeeef1]" aria-hidden />
      {cashRows.map(({ key, ...row }) => (
        <Row key={key} {...row} signed />
      ))}
    </>
  )
}

/** Every SI number rung up this session, in order — what the pad must match. */
function InvoiceList({ numbers }: { numbers: string[] }): React.JSX.Element {
  return (
    <div className="border-t border-[#f4f4f6] px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12.5px]">Invoice numbers</span>
        <span className="text-[11px] text-[#5b5b6b]">
          {numbers.length} invoice{numbers.length === 1 ? '' : 's'}
        </span>
      </div>
      {numbers.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Invoice numbers">
          {numbers.map((number) => (
            <li
              key={number}
              className="rounded-[5px] border border-[#e4e4e9] bg-[#fbfbfc] px-1.5 py-0.5 font-mono text-[11px]"
            >
              {number}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-[10.5px] text-[#5b5b6b]">
          No invoice numbers recorded this session.
        </p>
      )}
    </div>
  )
}

/** One figure. `signed` rows print a deduction with a minus and a zero as a
 * dash, as the expected-cash build-up always has. */
function Row({
  label,
  note,
  amount,
  strong = false,
  signed = false,
}: Omit<CashRow, 'key'> & { signed?: boolean }): React.JSX.Element {
  const text = strong
    ? `₱${peso(amount)}`
    : !signed
      ? `₱${peso(amount)}`
      : amount === 0
        ? '—'
        : amount < 0
          ? `−${peso(-amount)}`
          : peso(amount)
  return (
    <div
      className={`flex items-start justify-between gap-4 border-t border-[#f4f4f6] px-4 ${
        strong ? 'border-[#e4e4e9] bg-[#fbfbfc] py-3' : 'py-2.5'
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className={strong ? 'text-[13px] font-semibold' : 'text-[12.5px]'}>{label}</span>
        <span className="text-[10.5px] text-[#5b5b6b]">{note}</span>
      </div>
      <span
        className={`shrink-0 tabular-nums ${
          strong
            ? 'text-[17px] font-semibold tracking-[-.01em]'
            : `text-[12.5px] font-medium ${
                signed && amount === 0 ? 'text-[#5b5b6b]' : amount < 0 ? 'text-[#8a4b06]' : ''
              }`
        }`}
      >
        {text}
      </span>
    </div>
  )
}
