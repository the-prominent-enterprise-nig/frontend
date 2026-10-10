'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TaxClosing, type VatPreview } from '@/src/libs/data/TaxReportsData'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { manilaToday, presetPeriod } from '@/src/libs/tax/tax-reports'
import EntryTable from '../../../_components/EntryTable'

// Settle VAT through a day: Output VAT and Input VAT are cleared into VAT
// Payable. The screen shows the entry before anything is posted, and says why
// when it cannot be.
export default function VatSettlementForm() {
  const router = useRouter()
  const params = useSearchParams()
  const today = manilaToday()
  const [asOf, setAsOf] = useState(params.get('asOf') || presetPeriod('last-month').endDate)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<VatPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const future = !asOf || asOf > today

  useEffect(() => {
    if (future) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await TaxClosing.previewVat(asOf)
      if (cancelled) return
      if (res.success && res.data) {
        setPreview(res.data)
        setError(null)
      } else {
        setPreview(null)
        setError(res.message || res.error || 'Could not read the balances')
      }
      setLoading(false)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [asOf, future])

  const post = async () => {
    setSaving(true)
    setError(null)
    const res = await TaxClosing.settleVat({ asOf, notes: notes.trim() || undefined })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not post the settlement')
      return
    }
    router.push(`/accounting/tax-closing/${res.data.id}`)
  }

  // A day that has not happened shows nothing: whatever was read for another day is not it.
  const shown = future ? null : preview
  const net = shown?.netPayable ?? 0
  const blocked = !shown || shown.blockers.length > 0

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href="/accounting/tax-closing"
        className="mb-3 inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tax Closing
      </Link>
      <h1 className="text-2xl font-bold text-prominent-purple-900">Settle VAT</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        Clears the Output VAT and Input VAT the books hold as of the end of the day you choose, and
        puts the difference in VAT Payable: owed to the BIR if Output VAT is higher, creditable if
        Input VAT is. The entry is dated that day.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Settle VAT through</span>
          <input
            type="date"
            aria-label="Settle VAT through"
            value={asOf}
            max={today}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {shown?.lastSettledAsOf && (
          <div className="pb-2 text-[13px] text-gray-500">
            Last settled through <b>{shown.lastSettledAsOf}</b>
          </div>
        )}
      </div>

      {(error || (asOf && future)) && (
        <div
          data-testid="settle-error"
          className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {future && asOf ? 'Pick a day that has already happened.' : error}
        </div>
      )}

      {shown && (
        <>
          {shown.blockers.length > 0 && (
            <div
              data-testid="settle-blockers"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {shown.blockers.map((b) => (
                <div key={b}>{b}</div>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Stat
              label="Output VAT to clear"
              value={fmtMoney(shown.outputVat)}
              testId="settle-output"
            />
            <Stat
              label="Input VAT to clear"
              value={fmtMoney(shown.inputVat)}
              testId="settle-input"
            />
            <Stat
              label={net >= 0 ? 'VAT payable' : 'VAT creditable'}
              value={fmtMoney(Math.abs(net))}
              testId="settle-net"
              tone={net >= 0 ? 'amber' : 'green'}
            />
            <Stat
              label="In VAT Payable now"
              value={fmtMoney(shown.payable?.balance ?? 0)}
              testId="settle-payable"
            />
          </div>

          {shown.lines.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
                The entry this will post, dated {shown.asOf}
              </h2>
              <EntryTable
                testId="settle-entry"
                lines={shown.lines.map((l) => ({
                  key: l.accountId,
                  account: l.number,
                  accountName: l.name,
                  description: l.description,
                  debit: l.debit,
                  credit: l.credit,
                }))}
              />
            </>
          )}

          <label className="mt-5 block max-w-xl">
            <span className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</span>
            <textarea
              aria-label="Notes"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-5 flex gap-3">
            <button
              data-testid="post-settlement"
              onClick={post}
              disabled={blocked || saving || loading}
              className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Posting…' : 'Post settlement'}
            </button>
            <Link
              href="/accounting/tax-closing"
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </Link>
          </div>
          <p className="mt-2 text-[12px] text-gray-500">
            It can be reversed afterwards, newest run first. A reversal is dated the day it is made.
          </p>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  testId,
  tone = 'purple',
}: {
  label: string
  value: string
  testId: string
  tone?: 'purple' | 'amber' | 'green'
}) {
  const border =
    tone === 'amber'
      ? 'border-amber-200'
      : tone === 'green'
        ? 'border-green-200'
        : 'border-purple-100'
  return (
    <div data-testid={testId} className={`rounded-lg border ${border} bg-white px-4 py-3`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-prominent-purple-900">{value}</div>
    </div>
  )
}
