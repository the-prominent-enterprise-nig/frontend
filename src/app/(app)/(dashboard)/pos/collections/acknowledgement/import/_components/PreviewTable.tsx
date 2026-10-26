'use client'

import { ChevronDown } from 'lucide-react'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type {
  AcknowledgementImportCells,
  AcknowledgementImportRow,
} from '@/src/schema/pos/acknowledgement-import'
import type { EditableImportRow } from '../_hooks/useReceiptsImport'
import type { ImportLookups } from '../_hooks/useImportLookups'
import RowEditPanel from './RowEditPanel'

type Status = AcknowledgementImportRow['status']

// One look per status, used everywhere a row shows its state: the 3px edge on
// the left, the pill, and the colour of its messages.
const STATUS_STYLES: Record<
  Status,
  { label: string; pill: string; edge: string; dot: string; message: string }
> = {
  ok: {
    label: 'OK',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    edge: 'border-l-transparent',
    dot: 'bg-gray-400',
    message: 'text-gray-700',
  },
  warning: {
    label: 'Warning',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    edge: 'border-l-amber-400',
    dot: 'bg-amber-500',
    message: 'text-amber-900',
  },
  error: {
    label: 'Error',
    pill: 'bg-red-50 text-red-700 ring-red-200',
    edge: 'border-l-red-500',
    dot: 'bg-red-500',
    message: 'text-red-800',
  },
}

// Row · Customer · Gross · Subsidy · Withholding · Net · Status · Actions.
// The money columns have a floor wide enough for a figure like ₱1,250,000.00,
// so they never run into each other; the Customer column is the one that gives
// (and truncates). This grid only applies when the review section — the page's
// content area, not the window — is at least 1000px wide; narrower than that
// each receipt is the stacked summary instead. (Class names are written out in
// full: Tailwind can't see one built from pieces.)
const GRID =
  '@min-[1000px]:grid-cols-[2rem_minmax(0,2.4fr)_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_minmax(7rem,1.1fr)_5.5rem_8rem]'

function money(n: number | null | undefined) {
  return n === null || n === undefined ? '—' : fmtMoney(n)
}

/** "4-01-095" out of "4-01-095 — Sales Discounts and Rebates"; a label with no
 * number in front (a default account's name) is shown as it is. */
function accountNumber(label: string | null): string {
  if (!label) return 'default'
  const match = /^\s*(\d[\d-]*\d)/.exec(label)
  return match ? match[1] : label
}

function StatusPill({ status }: { status: Status }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.pill}`}
    >
      {style.label}
    </span>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'purple' | 'gray' }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === 'purple' ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-700'
      }`}
    >
      {children}
    </span>
  )
}

/** A deduction column: the amount, with its account number small underneath —
 * or a dash when there is none. */
function DeductionCell({ amount, accountLabel }: { amount: number; accountLabel: string | null }) {
  if (!(amount > 0)) return <span className="text-gray-400">—</span>
  return (
    <>
      <div>{money(amount)}</div>
      <div className="truncate text-[11px] text-gray-500" title={accountLabel ?? undefined}>
        {accountNumber(accountLabel)}
      </div>
    </>
  )
}

/** The review list: one line per receipt with what the server made of it, its
 * messages as readable lines underneath, and an Edit toggle that opens the
 * row's own cells right below (flat, not a modal). While the rows are being
 * re-checked the figures are dimmed — they describe the rows as they were a
 * moment ago. Below `md` each receipt collapses to a stacked summary. */
export default function PreviewTable({
  rows,
  editable,
  expanded,
  checking,
  disabled,
  lookups,
  onToggle,
  onRemove,
  onCellsChange,
}: {
  rows: AcknowledgementImportRow[]
  /** The rows as the user has them, by row number — source of each panel's
   * inputs and of the "edited" tag. */
  editable: Map<number, EditableImportRow>
  expanded: ReadonlySet<number>
  checking: boolean
  disabled: boolean
  lookups: ImportLookups
  onToggle: (rowNumber: number) => void
  onRemove: (rowNumber: number) => void
  onCellsChange: (rowNumber: number, patch: AcknowledgementImportCells) => void
}) {
  return (
    <div role="table" aria-label="Receipts to import">
      <div
        role="row"
        className={`hidden border-b border-l-3 border-gray-200 border-l-transparent bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-gray-500 @min-[1000px]:grid @min-[1000px]:gap-x-3 ${GRID}`}
      >
        <span>Row</span>
        <span>Customer</span>
        <span className="text-right">Gross</span>
        <span className="text-right">Subsidy</span>
        <span className="text-right">Withholding</span>
        <span className="text-right">Net</span>
        <span>Status</span>
        <span />
      </div>

      {rows.map((row) => {
        const style = STATUS_STYLES[row.status]
        const d = row.data
        const own = editable.get(row.rowNumber)
        const open = expanded.has(row.rowNumber)
        const netDiffers =
          d.uploadedNet !== null && Math.abs(d.uploadedNet - d.calculatedNet) >= 0.005
        const detail = [d.invoiceNo, d.description].filter(Boolean).join(' · ')
        const dim = checking ? 'opacity-60' : ''

        const toggle = (
          <button
            type="button"
            onClick={() => onToggle(row.rowNumber)}
            aria-expanded={open}
            disabled={!own}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-semibold text-purple-700 transition-colors hover:bg-purple-50 hover:text-purple-900 disabled:opacity-40"
          >
            {open ? 'Close' : 'Edit'}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )
        const remove = (
          <button
            type="button"
            onClick={() => onRemove(row.rowNumber)}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-[13px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          >
            Remove
          </button>
        )
        const pills = (
          <>
            {row.newCustomer && <Pill tone="purple">new</Pill>}
            {own?.edited && <Pill tone="gray">edited</Pill>}
          </>
        )

        return (
          <div
            key={row.rowNumber}
            role="rowgroup"
            className={`border-b border-l-3 border-gray-100 last:border-b-0 ${style.edge}`}
          >
            {/* wide content area — one line per receipt */}
            <div
              role="row"
              className={`hidden items-start px-3 py-3 text-sm @min-[1000px]:grid @min-[1000px]:gap-x-3 ${GRID} ${dim}`}
            >
              <span className="pt-0.5 text-xs tabular-nums text-gray-400">{row.rowNumber}</span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="truncate font-medium text-gray-900"
                    title={d.customerName ?? undefined}
                  >
                    {d.customerName || '—'}
                  </span>
                  {pills}
                </div>
                {detail && (
                  <div className="mt-0.5 truncate text-xs text-gray-500" title={detail}>
                    {detail}
                  </div>
                )}
              </div>
              <div className="text-right tabular-nums whitespace-nowrap text-gray-900">
                {money(d.grossAmount)}
              </div>
              <div className="text-right tabular-nums whitespace-nowrap text-gray-900">
                <DeductionCell amount={d.subsidyAmount} accountLabel={d.subsidyAccountLabel} />
              </div>
              <div className="text-right tabular-nums whitespace-nowrap text-gray-900">
                <DeductionCell
                  amount={d.withholdingAmount}
                  accountLabel={d.withholdingAccountLabel}
                />
              </div>
              <div className="text-right tabular-nums whitespace-nowrap">
                <div className="font-medium text-gray-900">{money(d.calculatedNet)}</div>
                {netDiffers && (
                  <div className="text-[11px] text-amber-700">uploaded {money(d.uploadedNet)}</div>
                )}
              </div>
              <div>
                <StatusPill status={row.status} />
              </div>
              <div className="flex items-center justify-end gap-1">
                {toggle}
                {remove}
              </div>
            </div>

            {/* narrower content area — a stacked summary */}
            <div className={`px-3 py-3 text-sm @min-[1000px]:hidden ${dim}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-xs tabular-nums text-gray-400">
                      #{row.rowNumber}
                    </span>
                    <span className="truncate font-medium text-gray-900">
                      {d.customerName || '—'}
                    </span>
                    {pills}
                  </div>
                  {detail && <div className="mt-0.5 truncate text-xs text-gray-500">{detail}</div>}
                </div>
                <StatusPill status={row.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="tabular-nums text-gray-700">
                  {money(d.grossAmount)} <span className="text-gray-400">→</span>{' '}
                  <span className="font-medium text-gray-900">{money(d.calculatedNet)}</span>
                  {netDiffers && (
                    <span className="ml-2 text-[11px] text-amber-700">
                      uploaded {money(d.uploadedNet)}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  {toggle}
                  {remove}
                </div>
              </div>
            </div>

            {row.messages.length > 0 && (
              <ul className={`space-y-1 px-3 pb-3 @min-[1000px]:pl-14 ${dim}`}>
                {row.messages.map((m, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-[13px] leading-5 ${style.message}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                    />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            )}

            {open && own && (
              <div className="mx-3 mb-4 border-l-2 border-purple-300 bg-gray-50 p-5 @min-[1000px]:ml-14">
                <RowEditPanel
                  row={row}
                  cells={own.cells}
                  lookups={lookups}
                  disabled={disabled}
                  onChange={(patch) => onCellsChange(row.rowNumber, patch)}
                  onClose={() => onToggle(row.rowNumber)}
                  onRemove={() => onRemove(row.rowNumber)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
