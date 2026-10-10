'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  TaxClosing,
  type SettlementEntry,
  type TaxSettlementDetail,
} from '@/src/libs/data/TaxReportsData'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { SETTLEMENT_TYPE_LABEL } from '@/src/libs/tax/tax-reports'
import EntryTable from '../../_components/EntryTable'

// One closing run: what it cleared, the entry it posted, and — for the latest
// run still in force — the way to undo it. Undoing is a section of this page,
// not a dialog: it wants a reason, and the reason is kept.
export default function TaxClosingDetail({ id, canReverse }: { id: string; canReverse: boolean }) {
  const [run, setRun] = useState<TaxSettlementDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [reversing, setReversing] = useState(false)
  const [reverseError, setReverseError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await TaxClosing.get(id)
    if (res.success && res.data) {
      setRun(res.data)
      setError(null)
    } else {
      setError(res.message || res.error || 'Could not load the run')
    }
  }, [id])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const reverse = async () => {
    setReversing(true)
    setReverseError(null)
    const res = await TaxClosing.reverse(id, reason.trim())
    setReversing(false)
    if (!res.success || !res.data) {
      setReverseError(res.message || res.error || 'Could not reverse the run')
      return
    }
    setRun(res.data)
    setReason('')
  }

  if (error) {
    return (
      <div className="px-6 py-6 lg:px-10">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }
  if (!run) return <div className="px-6 py-6 text-sm text-gray-400 lg:px-10">Loading…</div>

  const vat = run.type === 'VAT_SETTLEMENT'

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href="/accounting/tax-closing"
        className="mb-3 inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tax Closing
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1
          className="font-mono text-2xl font-bold text-prominent-purple-900"
          data-testid="run-number"
        >
          {run.settlementNumber}
        </h1>
        <span
          data-testid="run-status"
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            run.status === 'POSTED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {run.status === 'POSTED' ? 'In force' : 'Reversed'}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{SETTLEMENT_TYPE_LABEL[run.type]}</p>

      <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item label={vat ? 'Settled through' : 'Remitted through'} value={run.asOfDate} />
        <Item label={vat ? 'Entry dated' : 'Paid on'} value={run.postingDate} />
        {vat ? (
          <>
            <Item label="Output VAT cleared" value={fmtMoney(run.outputVat)} />
            <Item label="Input VAT cleared" value={fmtMoney(run.inputVat)} />
            <Item
              label={run.netAmount >= 0 ? 'VAT payable' : 'VAT creditable'}
              value={fmtMoney(Math.abs(run.netAmount))}
              testId="run-amount"
            />
          </>
        ) : (
          <>
            <Item label="Remitted" value={fmtMoney(run.netAmount)} testId="run-amount" />
            <Item label="Paid from" value={run.bankName ?? '—'} />
            <Item label="BIR reference" value={run.reference ?? '—'} />
          </>
        )}
        <Item label="Posted by" value={run.createdByName ?? '—'} />
        <Item label="Posted at" value={new Date(run.createdAt).toLocaleString('en-PH')} />
        {run.notes && <Item label="Notes" value={run.notes} />}
      </dl>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
        The entry it posted
      </h2>
      {run.entry ? (
        <EntryBlock entry={run.entry} journalEntryId={run.journalEntryId} testId="run-entry" />
      ) : (
        <p className="text-sm text-gray-500">No entry on record.</p>
      )}

      {run.status === 'REVERSED' && (
        <div data-testid="run-reversal" className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-prominent-purple-900">Reversed</h2>
          <p className="mb-2 text-sm text-gray-600">
            {run.reversedByName ?? 'Someone'} reversed it on{' '}
            {run.reversedAt ? new Date(run.reversedAt).toLocaleString('en-PH') : '—'}:{' '}
            <i>{run.reversalReason}</i>
          </p>
          {run.reversalEntry && (
            <EntryBlock
              entry={run.reversalEntry}
              journalEntryId={run.reversalJournalEntryId}
              testId="run-reversal-entry"
            />
          )}
        </div>
      )}

      {run.status === 'POSTED' && canReverse && (
        <div className="mt-8 max-w-2xl rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-prominent-purple-900">Undo this run</h2>
          {run.canReverse ? (
            <>
              <p className="mt-1 text-[13px] text-gray-500">
                Posts the opposite entry, dated today, and keeps this record. The balances go back
                into the accounts, and the day can be run again.
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Why (required)</span>
                <textarea
                  aria-label="Reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              {reverseError && (
                <div
                  data-testid="reverse-error"
                  className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
                >
                  {reverseError}
                </div>
              )}
              <button
                data-testid="reverse-run"
                onClick={reverse}
                disabled={reversing || reason.trim().length < 3}
                className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reversing ? 'Reversing…' : 'Reverse this run'}
              </button>
            </>
          ) : (
            <p data-testid="cannot-reverse" className="mt-1 text-[13px] text-gray-500">
              A later run of this kind is still in force. Runs are undone newest first, so reverse
              that one before this.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Item({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd data-testid={testId} className="mt-0.5 text-sm text-gray-900">
        {value}
      </dd>
    </div>
  )
}

function EntryBlock({
  entry,
  journalEntryId,
  testId,
}: {
  entry: SettlementEntry
  journalEntryId: string | null
  testId: string
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] text-gray-500">
        {entry.description} ·{' '}
        {journalEntryId ? (
          <Link
            href={`/accounting/journal-entries/${journalEntryId}`}
            className="font-mono text-purple-700 hover:underline"
          >
            {entry.code}
          </Link>
        ) : (
          entry.code
        )}{' '}
        · dated {entry.date}
      </p>
      <EntryTable
        testId={testId}
        lines={entry.lines.map((l, i) => ({
          key: `${l.accountNumber}-${i}`,
          account: l.accountNumber,
          accountName: l.accountName,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
        }))}
      />
    </div>
  )
}
