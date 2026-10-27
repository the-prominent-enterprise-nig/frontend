'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Skeleton } from '@/src/components/ui/Skeleton'
import type { ShiftTransaction } from '@/src/schema/pos'
import { tenderLabel } from './tender-label'

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
  /** The shift's transactions — what the total sales breakdown is built from. */
  transactions: ShiftTransaction[]
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
  transactions,
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
      <TotalSales netSales={netSales} totalRefunds={totalRefunds} transactions={transactions} />
      <InvoiceList numbers={invoiceNumbers} />
      <div className="border-t border-[#eeeef1]" aria-hidden />
      {cashRows.map(({ key, ...row }) => (
        <Row key={key} {...row} signed />
      ))}
    </>
  )
}

type BreakdownRow = { key: string; label: string; amount: number }

/**
 * How the shift's sales were paid, summing to Total sales: each tender, the
 * TPF financier's share, and what no tender covers — an in-house installment
 * balance the customer pays NIG later. Refunds come off the end.
 */
function salesBreakdown(transactions: ShiftTransaction[]): BreakdownRow[] {
  const byKey = new Map<string, number>()
  const add = (key: string, amount: number): void => {
    byKey.set(key, (byKey.get(key) ?? 0) + amount)
  }
  for (const t of transactions) {
    if (t.status !== 'completed') continue
    if (t.transactionType === 'refund') {
      add('refund', -t.totalAmount)
      continue
    }
    const paid = t.tenders.reduce((sum, p) => sum + p.amount, 0)
    t.tenders.forEach((p) => add(p.key, p.amount))
    const rest = t.totalAmount - paid
    if (Math.abs(rest) >= 0.005) add(rest > 0 ? 'on-account' : 'change', rest)
  }
  return [...byKey.entries()]
    .filter(([, amount]) => Math.abs(amount) >= 0.005)
    .map(([key, amount]) => ({ key, label: breakdownLabel(key), amount }))
    .sort((a, b) => breakdownOrder(a.key) - breakdownOrder(b.key) || a.label.localeCompare(b.label))
}

function breakdownLabel(key: string): string {
  if (key === 'on-account') return 'In-house installment (on account)'
  if (key === 'change') return 'Change given'
  if (key === 'refund') return 'Less: refunds'
  return tenderLabel(key)
}

// Cash first, then the other tenders, TPF, the on-account balance, and the
// deductions last — the order a cashier reads a sales recap in.
function breakdownOrder(key: string): number {
  if (key === 'cash') return 0
  if (key.startsWith('tpf')) return 2
  if (key === 'on-account') return 3
  if (key === 'change' || key === 'refund') return 4
  return 1
}

/** Total sales, opening onto how it was paid so the cashier can check it. */
function TotalSales({
  netSales,
  totalRefunds,
  transactions,
}: {
  netSales: number
  totalRefunds: number
  transactions: ShiftTransaction[]
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rows = salesBreakdown(transactions)
  return (
    <div className="border-t border-[#f4f4f6]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={rows.length === 0}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-4 py-2.5 text-left disabled:cursor-default"
      >
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 text-[12.5px]">
            Total sales
            {rows.length > 0 && (
              <ChevronDown
                size={12}
                className={`text-[#7c4fd1] transition-transform ${open ? '' : '-rotate-90'}`}
              />
            )}
          </span>
          <span className="text-[10.5px] text-[#5b5b6b]">
            {totalRefunds ? `net of ₱${peso(totalRefunds)} refunded` : 'completed sales'}
            {rows.length > 0 && !open ? ' · see how it was paid' : ''}
          </span>
        </div>
        <span className="shrink-0 text-[12.5px] font-medium tabular-nums">₱{peso(netSales)}</span>
      </button>
      {open && (
        <div className="flex flex-col pb-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_96px] items-baseline gap-2.5 py-1 pl-8 pr-4"
            >
              <span className="min-w-0 text-[11.5px] leading-[1.4] text-[#5b5b6b]">
                {row.label}
              </span>
              <span className="text-right text-[11.5px] tabular-nums text-[#3d3d4a]">
                {row.amount < 0 ? `−${peso(-row.amount)}` : peso(row.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
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
