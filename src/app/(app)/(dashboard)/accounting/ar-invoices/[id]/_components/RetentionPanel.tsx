'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ARInvoices,
  fmtDate,
  fmtMoney,
  type RetentionActionType,
  type RetentionHistory,
} from '@/src/libs/data/AccountingV2Data'

const ACTION_LABEL: Record<RetentionActionType, string> = {
  RELEASE: 'Released by customer',
  OFFSET: 'Offset against a claim',
  WRITE_OFF: 'Written off',
  PROVISION: 'Provided for as doubtful',
}

/**
 * The retention an invoice carries: what the customer holds back, what has left
 * it (released, offset, written off) and what is still held, with the actions
 * taken. Releasing is a collection; offsetting and writing off are adjustments
 * that need approval, so they have their own pages and their own permission.
 */
export default function RetentionPanel({
  invoiceId,
  status,
  retentionPercent,
  retentionAmount,
  retentionReleaseDate,
  retentionMilestone,
  canRelease,
  canAdjust,
}: {
  invoiceId: string
  status: string
  retentionPercent: number | null
  retentionAmount: number
  retentionReleaseDate: string | null
  retentionMilestone: string | null
  canRelease: boolean
  canAdjust: boolean
}) {
  const [history, setHistory] = useState<RetentionHistory | null>(null)

  useEffect(() => {
    let cancelled = false
    ARInvoices.retentionHistory(invoiceId).then((res) => {
      if (!cancelled && res.success && res.data) setHistory(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const held = history?.held ?? retentionAmount
  const open = ['SENT', 'PARTIAL', 'OVERDUE'].includes(status)
  const sum = (types: RetentionActionType[]) =>
    (history?.actions ?? []).filter((a) => types.includes(a.type)).reduce((n, a) => n + a.amount, 0)
  const released = sum(['RELEASE'])
  const offset = sum(['OFFSET'])
  const writtenOff = sum(['WRITE_OFF'])
  const due = retentionReleaseDate ? new Date(retentionReleaseDate) : null
  const pastDue = held > 0 && !!due && due.getTime() < Date.now()
  const base = `/accounting/ar-invoices/${invoiceId}/retention`

  return (
    <section
      className="mt-3 rounded-lg border border-gray-200 bg-white p-5"
      data-testid="retention-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-prominent-purple-900">
            Retention{retentionPercent ? ` · ${retentionPercent}%` : ''}
          </h2>
          <p className="mt-0.5 text-[12px] text-gray-500">
            Held back by the customer under the contract. It sits in Retention Receivable, not in
            Accounts Receivable, until it is released, offset or written off.
          </p>
        </div>
        {open && held > 0 && (
          <div className="flex flex-wrap gap-2">
            {canRelease && (
              <Link
                href={`${base}/release`}
                data-testid="retention-release"
                className="rounded-lg bg-purple-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-purple-800"
              >
                Record release
              </Link>
            )}
            {canAdjust && (
              <>
                <Link
                  href={`${base}/offset`}
                  data-testid="retention-offset"
                  className="rounded-lg border border-purple-200 px-3 py-1.5 text-[13px] font-semibold text-purple-700 hover:bg-purple-50"
                >
                  Offset against a claim
                </Link>
                <Link
                  href={`${base}/doubtful`}
                  data-testid="retention-doubtful"
                  className="rounded-lg border border-purple-200 px-3 py-1.5 text-[13px] font-semibold text-purple-700 hover:bg-purple-50"
                >
                  Doubtful / write off
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Retained" value={fmtMoney(retentionAmount)} />
        <Tile label="Released" value={fmtMoney(released)} />
        <Tile label="Offset" value={fmtMoney(offset)} />
        <Tile label="Written off" value={fmtMoney(writtenOff)} />
        <Tile label="Still held" value={fmtMoney(held)} testId="retention-held" strong />
        <Tile
          label="Release due"
          value={due ? fmtDate(retentionReleaseDate!) : '—'}
          hint={pastDue ? 'Past due' : (retentionMilestone ?? undefined)}
          warn={pastDue}
        />
      </dl>
      {retentionMilestone && due && (
        <p className="mt-2 text-[12px] text-gray-500">Released on: {retentionMilestone}</p>
      )}

      {history && history.actions.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm" data-testid="retention-actions">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">What</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-left">Charged to / approved by</th>
              </tr>
            </thead>
            <tbody>
              {history.actions.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(a.actionDate)}</td>
                  <td className="px-3 py-2">{ACTION_LABEL[a.type]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(a.amount)}</td>
                  <td className="px-3 py-2">{a.reference ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {a.offsetAccount ?? '—'}
                    {a.approvedBy && (
                      <div className="text-[11px] text-gray-500">approved by {a.approvedBy}</div>
                    )}
                    {a.journalEntryId && (
                      <Link
                        href={`/accounting/journal-entries/${a.journalEntryId}`}
                        className="text-[11px] text-purple-700 hover:underline"
                      >
                        view entry
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Tile({
  label,
  value,
  hint,
  testId,
  strong,
  warn,
}: {
  label: string
  value: string
  hint?: string
  testId?: string
  strong?: boolean
  warn?: boolean
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd
        data-testid={testId}
        className={`mt-1 text-[16px] tabular-nums ${
          strong ? 'font-semibold text-prominent-purple-900' : 'text-gray-800'
        }`}
      >
        {value}
      </dd>
      {hint && (
        <div className={`text-[11px] ${warn ? 'font-medium text-red-600' : 'text-gray-500'}`}>
          {hint}
        </div>
      )}
    </div>
  )
}
