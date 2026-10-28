'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight, Loader2 } from 'lucide-react'
import type { OverrideReviewEntry } from '@/src/schema/pos'
import { creditOverrideLines } from '@/src/libs/pos/credit-override'
import {
  ENTRY_GRID,
  FLAG_STYLES,
  PLAN_LABELS,
  PLAN_SHORT,
  STATUS_ACCENT,
  STATUS_LABELS,
  STATUS_STYLES,
  flagLabel,
  formatClock,
  formatDay,
  formatTime,
  peso,
} from './override-review-format'

interface Props {
  entry: OverrideReviewEntry
  /** 1-based position among this sale's overridden lines, and how many there are. */
  itemNo: number
  itemsOnSale: number
  thresholdPct: number
  busy: boolean
  onDecide: (status: 'approved' | 'rejected', note?: string) => void
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-700">
        {title}
      </h4>
      <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">{children}</dl>
    </div>
  )
}

function Field({
  label,
  testId,
  children,
}: {
  label: string
  testId?: string
  children: React.ReactNode
}) {
  return (
    <>
      <dt className="text-gray-700">{label}</dt>
      <dd className="min-w-0 break-words text-gray-900" data-testid={testId}>
        {children}
      </dd>
    </>
  )
}

/**
 * One exception as a single line — sale, branch, customer, item, price,
 * discount, plan, flags and the decision — so a manager reads a day's worth down
 * the page. Clicking the row (or its chevron) opens the full receipt beneath it:
 * everything the line abbreviates, as labelled fields.
 *
 * Approve is one click; Reject opens a note row beneath first, because the note
 * is all a rejection records. Both work without opening the details.
 */
export default function OverrideEntryRow({
  entry,
  itemNo,
  itemsOnSale,
  thresholdPct,
  busy,
  onDecide,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const decidable = !entry.locked && entry.status !== 'voided'
  const sale = entry.salesInvoiceNumber ?? entry.transactionNumber
  const below = entry.belowListPct
  const decided = entry.status !== 'pending' && entry.status !== 'voided'
  const showDecision = decided && !!entry.decidedByName
  const canChange = decidable && entry.status !== 'pending' && !rejecting
  const customer = entry.customer?.name ?? 'Walk-in'
  const installment =
    entry.planKind === 'installment_term' || entry.planKind === 'installment_typed'
  const flagTitles = entry.flags.map((f) => flagLabel(f, thresholdPct))

  return (
    <div
      className="border-t border-gray-200 text-xs text-gray-900 first:border-t-0"
      data-testid="override-entry"
      data-status={entry.status}
      role="rowgroup"
    >
      <div
        role="row"
        // A click anywhere on the line opens the details — except on the things
        // that do something else (the sale link, the decision buttons).
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('a,button,input')) setOpen((v) => !v)
        }}
        className={`${ENTRY_GRID} min-h-10 cursor-pointer border-l-[3px] py-1.5 hover:bg-gray-50 ${STATUS_ACCENT[entry.status]}`}
      >
        <div role="cell">
          <button
            type="button"
            data-testid="entry-toggle"
            aria-expanded={open}
            aria-label={open ? 'Hide details' : 'Show details'}
            onClick={() => setOpen((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-700 hover:bg-gray-200"
          >
            <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        </div>

        <div role="cell" className="flex min-w-0 items-baseline gap-1.5">
          <Link
            href={`/pos/transactions?search=${encodeURIComponent(entry.transactionNumber)}`}
            title={entry.transactionNumber}
            className="truncate font-semibold text-prominent-purple-900 hover:underline"
          >
            {sale}
          </Link>
          <span className="shrink-0 tabular-nums">{formatClock(entry.occurredAt)}</span>
        </div>

        <div
          role="cell"
          className="truncate"
          title={entry.branchName ?? undefined}
          data-testid="entry-branch"
        >
          {entry.branchName ?? '—'}
        </div>

        <div role="cell" className="truncate" title={customer} data-testid="entry-customer">
          {customer}
        </div>

        <div role="cell" className="truncate" title={entry.item.name}>
          {entry.item.name}
          {entry.quantity !== 1 && ` × ${entry.quantity}`}
        </div>

        <div role="cell" className="text-right font-semibold tabular-nums">
          {peso(entry.unitPrice)}
        </div>

        <div role="cell" className="truncate text-right tabular-nums">
          {entry.difference === null ? (
            '—'
          ) : below !== null && below < 0 ? (
            <span className="text-amber-700">+{Math.abs(below).toFixed(1)}%</span>
          ) : (
            <span className="text-red-700">
              −{peso(entry.difference)}
              {below !== null && ` · ${below.toFixed(1)}%`}
            </span>
          )}
        </div>

        <div role="cell" className="truncate">
          {PLAN_SHORT[entry.planKind]}
        </div>

        <div
          role="cell"
          className="flex min-w-0 items-center gap-1 overflow-hidden"
          title={flagTitles.join(', ')}
        >
          {entry.flags.length > 0 && (
            <>
              <span
                className={`truncate whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold ${FLAG_STYLES[entry.flags[0]]}`}
              >
                {flagTitles[0]}
              </span>
              {entry.flags.length > 1 && (
                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-semibold text-gray-800">
                  +{entry.flags.length - 1}
                </span>
              )}
            </>
          )}
        </div>

        <div role="cell" className="flex justify-end">
          {entry.status === 'pending' && decidable && !rejecting ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                data-testid="entry-approve"
                disabled={busy}
                onClick={() => onDecide('approved')}
                className="flex h-6 items-center gap-1 rounded-md bg-purple-700 px-2.5 text-[11px] font-semibold text-white hover:bg-purple-800 disabled:opacity-40"
              >
                {busy && <Loader2 size={10} className="animate-spin" />}
                Approve
              </button>
              <button
                type="button"
                data-testid="entry-reject"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="h-6 rounded-md border border-red-300 bg-white px-2.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLES[entry.status]}`}
              >
                {STATUS_LABELS[entry.status]}
              </span>
              {canChange && (
                <button
                  type="button"
                  data-testid="entry-change"
                  disabled={busy}
                  title={entry.status === 'approved' ? 'Change to rejected' : 'Change to approved'}
                  onClick={() =>
                    entry.status === 'approved' ? setRejecting(true) : onDecide('approved')
                  }
                  className="text-[11px] font-medium text-purple-700 hover:underline disabled:opacity-40"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* A rejection needs its note — it is all the rejection records. */}
      {rejecting && (
        <div className="flex flex-wrap items-center gap-2 border-l-[3px] border-l-red-500 bg-red-50/60 px-3 py-2">
          <input
            data-testid="reject-note"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this rejected? (required)"
            className="h-8 min-w-72 flex-1 rounded-md border border-gray-300 bg-white px-3 text-xs outline-none focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100"
          />
          <button
            type="button"
            data-testid="reject-confirm"
            disabled={busy || note.trim().length === 0}
            onClick={() => {
              onDecide('rejected', note.trim())
              setRejecting(false)
              setNote('')
            }}
            className="flex h-8 items-center gap-1 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            Reject entry
          </button>
          <button
            type="button"
            onClick={() => {
              setRejecting(false)
              setNote('')
            }}
            className="h-8 px-2 text-xs font-medium text-gray-800 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      )}

      {/* The whole receipt */}
      {open && (
        <div
          className="grid gap-x-10 gap-y-4 border-t border-gray-200 bg-gray-50 py-3 pl-[59px] pr-4 @3xl:grid-cols-2 @6xl:grid-cols-4"
          data-testid="entry-details"
        >
          <Group title="Receipt">
            <Field label="Sale">{sale}</Field>
            {sale !== entry.transactionNumber && (
              <Field label="Reference">{entry.transactionNumber}</Field>
            )}
            <Field label="Customer">{customer}</Field>
            <Field label="Branch">{entry.branchName ?? '—'}</Field>
            <Field label="Date & time">
              {formatDay(entry.occurredAt)} · {formatClock(entry.occurredAt)}
            </Field>
            {entry.cashierName && <Field label="Cashier">{entry.cashierName}</Field>}
            <Field label="Sale total">{peso(entry.saleTotal)}</Field>
          </Group>

          <Group title="Item & price">
            <Field label="Item">
              {entry.item.name}
              {entry.quantity !== 1 && ` × ${entry.quantity}`}
            </Field>
            {entry.item.sku && <Field label="SKU">{entry.item.sku}</Field>}
            {entry.serials.length > 0 && (
              <Field label={entry.serials.length > 1 ? 'Serials' : 'Serial'} testId="entry-serial">
                {entry.serials.map((serial) => (
                  <p key={serial}>{serial}</p>
                ))}
              </Field>
            )}
            {itemsOnSale > 1 && (
              <Field label="In this sale">
                Item {itemNo} of {itemsOnSale}
              </Field>
            )}
            <Field label="List price">
              {entry.listUnitPrice === null ? 'No list price' : peso(entry.listUnitPrice)}
            </Field>
            <Field label={entry.quantity !== 1 ? 'Charged each' : 'Charged'}>
              {peso(entry.unitPrice)}
            </Field>
            {entry.difference !== null && (
              <Field label="Discount">
                {below !== null && below < 0 ? (
                  <span className="text-amber-700">{Math.abs(below).toFixed(1)}% above list</span>
                ) : (
                  <span className="text-red-700">
                    {peso(entry.difference)}
                    {below !== null && ` · ${below.toFixed(1)}% below list`}
                  </span>
                )}
              </Field>
            )}
          </Group>

          <Group title="Payment">
            <Field label="Type">{PLAN_LABELS[entry.planKind]}</Field>
            {entry.planKind === 'installment_typed' && (
              <Field label="Terms">Typed by the cashier</Field>
            )}
            {entry.planKind !== 'cash' && entry.downPayment !== null && (
              <Field label="Down payment">{peso(entry.downPayment)}</Field>
            )}
            {installment && entry.monthlyInstallment !== null && (
              <Field label="Monthly">{peso(entry.monthlyInstallment)}</Field>
            )}
            {installment && entry.termMonths !== null && (
              <Field label="Term">{entry.termMonths} months</Field>
            )}
            {installment && entry.firstDueDate && (
              <Field label="First due">{formatDay(entry.firstDueDate)}</Field>
            )}
            {entry.installmentAccount && (
              <Field label="Account">
                <Link
                  href={`/crm/installment-accounts/${entry.installmentAccount.id}`}
                  title={`Account ${entry.installmentAccount.accountNumber}`}
                  data-testid="entry-ia-link"
                  className="inline-flex items-center gap-0.5 font-semibold text-purple-700 hover:underline"
                >
                  View installment account
                  <ArrowUpRight size={12} className="shrink-0" />
                </Link>
              </Field>
            )}
          </Group>

          <Group title="Reason & decision">
            <Field label="Reason">{entry.reason?.name ?? '—'}</Field>
            {entry.note && <Field label="Note">{entry.note}</Field>}
            {entry.creditOverride && (
              <Field label="Credit app">
                {creditOverrideLines(entry.creditOverride).map((line) => (
                  <p key={line} className="text-red-700">
                    {line}
                  </p>
                ))}
              </Field>
            )}
            {entry.creditWarnings.length > 0 && (
              <Field label="Warnings">
                {entry.creditWarnings.map((w) => (
                  <p key={w} className="text-amber-700">
                    {w}
                  </p>
                ))}
              </Field>
            )}
            {entry.flags.length > 0 && (
              <Field label="Flags">
                <div className="flex flex-wrap gap-1">
                  {entry.flags.map((flag) => (
                    <span
                      key={flag}
                      className={`whitespace-nowrap rounded-full px-1.5 py-px text-[10.5px] font-semibold ${FLAG_STYLES[flag]}`}
                    >
                      {flagLabel(flag, thresholdPct)}
                    </span>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Decision" testId="entry-decision">
              {showDecision
                ? `by ${entry.decidedByName}${
                    entry.decidedAt
                      ? ` · ${formatDay(entry.decidedAt)} ${formatTime(entry.decidedAt)}`
                      : ''
                  }${entry.decisionNote ? ` — ${entry.decisionNote}` : ''}`
                : STATUS_LABELS[entry.status]}
            </Field>
          </Group>
        </div>
      )}
    </div>
  )
}
