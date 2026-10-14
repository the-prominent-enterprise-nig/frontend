'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { OverrideReviewEntry } from '@/src/schema/pos'
import { creditOverrideLines } from '@/src/libs/pos/credit-override'
import {
  FLAG_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  flagLabel,
  formatClock,
  formatDay,
  formatTime,
  peso,
  planText,
} from './override-review-format'

interface Props {
  entry: OverrideReviewEntry
  /** 1-based position among this sale's overridden lines, and how many there are. */
  itemNo: number
  itemsOnSale: number
  /** The day spans several branches, so each row says which. */
  showBranch: boolean
  thresholdPct: number
  busy: boolean
  onDecide: (status: 'approved' | 'rejected', note?: string) => void
}

const CELL = 'px-2.5 py-3 align-top'

/**
 * One exception as a table row — time, sale, item, seller, plan, list, charged,
 * discount, reason, flags, and the decision — so a manager reads a day's worth
 * down the page. Approve is one click; Reject opens a note row beneath first,
 * because the note is all a rejection records.
 *
 * A `<tbody>` per entry, not a bare `<tr>`: the reject note is a second row that
 * belongs to the same entry.
 */
export default function OverrideEntryRow({
  entry,
  itemNo,
  itemsOnSale,
  showBranch,
  thresholdPct,
  busy,
  onDecide,
}: Props): React.JSX.Element {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const decidable = !entry.locked && entry.status !== 'voided'
  const sale = entry.salesInvoiceNumber ?? entry.transactionNumber
  const below = entry.belowListPct

  return (
    <tbody
      className="border-t border-gray-200 text-[13px] text-gray-800 first:border-t-0"
      data-testid="override-entry"
      data-status={entry.status}
    >
      <tr>
        <td className={`${CELL} whitespace-nowrap tabular-nums text-gray-600`}>
          {formatClock(entry.occurredAt)}
        </td>

        <td className={CELL}>
          <Link
            href={`/pos/transactions?search=${encodeURIComponent(entry.transactionNumber)}`}
            className="font-semibold text-prominent-purple-900 hover:underline"
          >
            {sale}
          </Link>
          {showBranch && entry.branchName && (
            <p className="mt-0.5 text-[11px] text-gray-500">{entry.branchName}</p>
          )}
        </td>

        <td className={`${CELL} min-w-32`}>
          <span className="font-medium">{entry.item.name}</span>
          {entry.quantity !== 1 && <span className="text-gray-500"> × {entry.quantity}</span>}
          {itemsOnSale > 1 && (
            <p className="mt-0.5 text-[11px] text-gray-500">
              Item {itemNo} of {itemsOnSale} in this sale
            </p>
          )}
        </td>

        <td className={`${CELL} min-w-16 text-gray-700`}>{entry.sellerName ?? '—'}</td>

        <td className={`${CELL} min-w-32 text-gray-700`}>{planText(entry, itemsOnSale)}</td>

        <td className={`${CELL} whitespace-nowrap text-right tabular-nums text-gray-600`}>
          {entry.listUnitPrice === null ? '—' : peso(entry.listUnitPrice)}
        </td>

        <td className={`${CELL} whitespace-nowrap text-right font-semibold tabular-nums`}>
          {peso(entry.unitPrice)}
        </td>

        <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>
          {entry.difference === null ? (
            <span className="text-gray-400">—</span>
          ) : (
            <>
              <span className="font-medium">{peso(Math.abs(entry.difference))}</span>
              {below !== null && (
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {Math.abs(below).toFixed(1)}% {below >= 0 ? 'below' : 'above'}
                </p>
              )}
            </>
          )}
        </td>

        <td className={`${CELL} min-w-28`}>
          <span className="font-medium">{entry.reason?.name ?? '—'}</span>
          {entry.note && <p className="mt-0.5 text-[11px] text-gray-500">{entry.note}</p>}
          {entry.creditOverride &&
            creditOverrideLines(entry.creditOverride).map((line) => (
              <p key={line} className="mt-0.5 text-[11px] text-red-700">
                {line}
              </p>
            ))}
          {entry.creditWarnings.map((w) => (
            <p key={w} className="mt-0.5 text-[11px] text-amber-700">
              {w}
            </p>
          ))}
        </td>

        <td className={`${CELL} min-w-20`}>
          {entry.flags.length === 0 ? (
            <span className="text-[11px] text-gray-400">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {entry.flags.map((flag) => (
                <span
                  key={flag}
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${FLAG_STYLES[flag]}`}
                >
                  {flagLabel(flag, thresholdPct)}
                </span>
              ))}
            </div>
          )}
        </td>

        <td
          className={`${CELL} sticky right-0 min-w-40 bg-white text-right shadow-[-10px_0_8px_-8px_rgba(0,0,0,0.12)]`}
        >
          {entry.status === 'pending' && decidable && !rejecting ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="entry-approve"
                disabled={busy}
                onClick={() => onDecide('approved')}
                className="flex h-8 items-center gap-1 rounded-lg bg-purple-700 px-3.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-40"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Approve
              </button>
              <button
                type="button"
                data-testid="entry-reject"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="h-8 rounded-lg border border-red-300 bg-white px-3.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[entry.status]}`}
              >
                {STATUS_LABELS[entry.status]}
              </span>
              {entry.status !== 'pending' && entry.status !== 'voided' && entry.decidedByName && (
                <p className="text-[11px] text-gray-500" data-testid="entry-decision">
                  by {entry.decidedByName}
                  {entry.decidedAt
                    ? ` · ${formatDay(entry.decidedAt)} ${formatTime(entry.decidedAt)}`
                    : ''}
                  {entry.decisionNote ? ` — ${entry.decisionNote}` : ''}
                </p>
              )}
              {decidable && entry.status !== 'pending' && !rejecting && (
                <button
                  type="button"
                  data-testid="entry-change"
                  disabled={busy}
                  onClick={() =>
                    entry.status === 'approved' ? setRejecting(true) : onDecide('approved')
                  }
                  className="text-[11px] font-medium text-purple-700 hover:underline disabled:opacity-40"
                >
                  {entry.status === 'approved' ? 'Change to rejected' : 'Change to approved'}
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* A rejection needs its note — it is all the rejection records. */}
      {rejecting && (
        <tr>
          <td colSpan={11} className="bg-red-50/50 px-3 pb-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                data-testid="reject-note"
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this rejected? (required)"
                className="h-9 min-w-72 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100"
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
                className="flex h-9 items-center gap-1 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Reject entry
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(false)
                  setNote('')
                }}
                className="h-9 px-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  )
}
