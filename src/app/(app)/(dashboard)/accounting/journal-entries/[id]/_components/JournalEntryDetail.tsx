'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getJournalEntryById, type JournalEntry } from '@/src/libs/data/AccountingData'
import { sourceDocumentLink, type SourceLink } from '@/src/libs/format/sourceDocumentLink'
import { entryJournalLabel, formatJournalType } from '@/src/libs/format/journalType'
import PosExceptionPanel from '@/src/components/common/PosExceptionPanel'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border border-amber-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  VOID: 'bg-gray-100 text-gray-600 border border-gray-200',
}

function formatMoney(v: number | undefined | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
}

function formatDate(v: string | undefined | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** A line's amount, opening the document the entry came from when there is one
 * to open. */
function Amount({ value, source }: { value: number; source: SourceLink | null }) {
  if (!source) return <>{formatMoney(value)}</>
  return (
    <Link
      href={source.href}
      title={`Open ${source.kind}`}
      className="text-purple-700 hover:underline"
    >
      {formatMoney(value)}
    </Link>
  )
}

export default function JournalEntryDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getJournalEntryById(id).then((res) => {
      if (res.success && res.data) setEntry(res.data)
      else setError(res.error ?? 'Journal entry not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading entry…</div>
  }

  if (error || !entry) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/accounting/journal-entries"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Journal Entries
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const transactions = entry.transactions ?? []
  const source = sourceDocumentLink({
    sourceModule: entry.sourceModule,
    sourceDocumentId: entry.sourceDocumentId,
    sourceDocumentNo: entry.sourceDocumentNo,
    code: entry.reference,
    description: entry.description,
    posDepositId: entry.posDepositId,
  })
  // An amount opens its source only when that is a specific document. Where the
  // entry can only point at a list (the header link above still does), an amount
  // that opened a list would promise more than it delivers.
  const amountSource = source && !source.list ? source : null
  // Most entries are not about items at all — a collection is cash in and a
  // receivable down, a VAT accrual is one account against another. An Item
  // column of dashes on every row says nothing, so it appears only when at
  // least one line is for an item, which today means the revenue/COGS/
  // inventory lines a sale raises. Qty, Unit Price and Subtotal are not shown
  // at all: an entry is accounts and amounts, and those belong to the document
  // it came from.
  const showItemColumn = transactions.some((t) => t.item != null)
  // A sale posts its revenue side and its stock side (Dr Cost of Sales / Cr
  // Inventory) in one entry, and an installment sale's down payment (Dr cash
  // or bank / Cr Accounts Receivable) is added to that same entry once it is
  // tendered. Keep the blocks together with a gap between them — sale, then
  // any lines booked to another journal (the down payment, a Cash Receipt),
  // then stock; order within each block is unchanged. A collection on an
  // installment sale carries its interest recognition (Dr Unearned Interest
  // Income / Cr Interest Income) the same way — its own block after the cash
  // and receivable lines, with the same gap before it.
  type Line = (typeof transactions)[number]
  const isStockLine = (t: Line) =>
    t.account?.category === 'INVENTORY' || t.account?.category === 'COGS'
  // The interest a collection recognised (or a cancelled one took back). Told
  // by its description: the accounts also appear on the sale's own entry, where
  // they belong with the rest of the sale.
  const isInterestLine = (t: Line) =>
    /^(Interest recognized on collection|Cancel interest recognized):/.test(t.description ?? '')
  // The journal a line is booked to when it is not its entry's own.
  const otherJournal = (t: Line) =>
    !isStockLine(t) && t.journalType && t.journalType !== entry.journalType ? t.journalType : null
  const otherJournals = [...new Set(transactions.map(otherJournal).filter((j): j is string => !!j))]
  const lineGroups: { label: string | null; lines: Line[] }[] = [
    {
      label: null,
      lines: transactions.filter((t) => !isStockLine(t) && !otherJournal(t) && !isInterestLine(t)),
    },
    {
      label: null,
      lines: transactions.filter((t) => !isStockLine(t) && !otherJournal(t) && isInterestLine(t)),
    },
    ...otherJournals.map((j) => ({
      label: formatJournalType(j),
      lines: transactions.filter((t) => otherJournal(t) === j),
    })),
    { label: null, lines: transactions.filter(isStockLine) },
  ].filter((g) => g.lines.length > 0)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/accounting/journal-entries"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Journal Entries
      </Link>

      <header>
        {/* The description, not the reference. One sale raises two entries —
            "Installment Plan …" and "Installment Down Payment …" — and both
            carry the SAME source document number, so a reference heading made
            them identical on screen and sent readers to the wrong one. What
            the entry IS belongs at the top; the number it came from is a
            detail, and is still shown below and beside the date. */}
        <h1 className="text-2xl font-semibold text-prominent-purple-900">
          {entry.description || entry.reference || entry.id.slice(0, 8)}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {entry.reference && <span className="font-mono text-gray-600">{entry.reference}</span>}
          <span>{formatDate(entry.date)}</span>
          {entry.sourceModule ? (
            <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
              {entry.sourceModule}
            </span>
          ) : (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              MANUAL
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${STATUS_BADGE[entry.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {entry.status === 'POSTED' && <CheckCircle2 className="h-4 w-4" />}
            {entry.status}
          </span>
        </div>
        <div className="mt-2 grid max-w-lg grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
          {(entry.sourceDocumentNo || source) && (
            <>
              <span className="text-gray-500">Source document</span>
              {/* Scenario 62 — the last hop of a report drill-down:
                  figure → ledger line → this entry → the document itself. */}
              {source ? (
                <Link
                  href={source.href}
                  className="text-left font-medium tabular-nums text-purple-700 hover:underline"
                >
                  {entry.sourceDocumentNo || `Open ${source.kind}`}
                  <span className="ml-2 text-xs font-normal text-gray-500">{source.kind}</span>
                </Link>
              ) : (
                <span className="text-left font-medium tabular-nums text-gray-800">
                  {entry.sourceDocumentNo}
                </span>
              )}
            </>
          )}
          {entry.voucherControlNo && (
            <>
              <span className="text-gray-500">Voucher Control No.</span>
              <span className="text-left font-medium tabular-nums text-gray-800">
                {entry.voucherControlNo}
              </span>
            </>
          )}
          <span className="text-gray-500">Branch</span>
          <span className="text-left font-medium text-gray-800">
            {entry.branchName ?? 'Tenant-wide'}
          </span>
          <span className="text-gray-500">Type</span>
          <span className="text-left font-medium text-gray-800">{entryJournalLabel(entry)}</span>
          {entry.payee && (
            <>
              <span className="text-gray-500">Payee</span>
              <span className="text-left font-medium text-gray-800">{entry.payee}</span>
            </>
          )}
          {entry.postedBy && (
            <>
              <span className="text-gray-500">Posted by</span>
              <span className="text-left font-medium tabular-nums text-gray-800">
                {entry.postedByName ?? entry.postedBy} · {formatDate(entry.postedAt)}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Scenario 71 — a POS sale's price override / typed terms / waiver, with
          its reason and note: why the price in these lines is what it is. */}
      {entry.posException && <PosExceptionPanel exception={entry.posException} className="mt-6" />}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Transaction Lines</h2>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-gray-400">No transaction lines.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Account</th>
                  {showItemColumn && <th className="py-2 pr-4">Item</th>}
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              {lineGroups.map((group, gi) => (
                <Fragment key={gi}>
                  {gi > 0 && (
                    <tbody>
                      <tr>
                        <td
                          colSpan={showItemColumn ? 5 : 4}
                          className="h-10 bg-gray-100 px-3 align-middle text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {group.label}
                        </td>
                      </tr>
                    </tbody>
                  )}
                  <tbody className="divide-y divide-gray-100">
                    {group.lines.map((t, i) => (
                      <tr key={t.id ?? i}>
                        <td className="py-2 pr-4 text-gray-900">
                          {t.account ? `${t.account.number} — ${t.account.name}` : t.accountId}
                        </td>
                        {showItemColumn && (
                          <td className="py-2 pr-4 text-gray-600">{t.item?.name ?? '—'}</td>
                        )}
                        <td className="py-2 pr-4 text-gray-500">{t.description || '—'}</td>
                        <td className="py-2 pr-4 text-right font-medium tabular-nums">
                          {t.debit ? <Amount value={t.debit} source={amountSource} /> : '—'}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {t.credit ? <Amount value={t.credit} source={amountSource} /> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Fragment>
              ))}
              <tfoot className="border-t border-gray-300">
                <tr>
                  <td
                    colSpan={showItemColumn ? 3 : 2}
                    className="py-2 pr-4 text-right font-semibold text-gray-600"
                  >
                    Total
                  </td>
                  <td className="py-2 pr-4 text-right font-bold tabular-nums">
                    {formatMoney(entry.totalDebit)}
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums">
                    {formatMoney(entry.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
