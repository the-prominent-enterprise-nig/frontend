'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TaxClosing, type WhtPreview } from '@/src/libs/data/TaxReportsData'
import { BankAccounts, fmtMoney, type BankAccount } from '@/src/libs/data/AccountingV2Data'
import { manilaToday, presetPeriod } from '@/src/libs/tax/tax-reports'
import EntryTable from '../../../_components/EntryTable'

// Remit withholding tax: the Withholding Tax Payable owed through a day is
// paid out of a bank account. Two dates, because they are two things: the day
// the remittance COVERS, and the day the money LEFT (when the entry is dated).
export default function WhtRemittanceForm() {
  const router = useRouter()
  const params = useSearchParams()
  const today = manilaToday()
  const [asOf, setAsOf] = useState(params.get('asOf') || presetPeriod('last-month').endDate)
  const [paymentDate, setPaymentDate] = useState('')
  const [bankId, setBankId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [banksLoaded, setBanksLoaded] = useState(false)
  const [preview, setPreview] = useState<WhtPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    BankAccounts.list().then((r) => {
      setBanks((r.success && r.data ? r.data : []).filter((b) => b.isActive))
      setBanksLoaded(true)
    })
  }, [])

  // The payment date follows the covered day until someone sets it themselves.
  const paid = paymentDate || asOf

  const future = !asOf || asOf > today

  useEffect(() => {
    if (future) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await TaxClosing.previewWht(asOf)
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

  // A day that has not happened shows nothing: whatever was read for another day is not it.
  const shown = future ? null : preview
  const bank = banks.find((b) => b.id === bankId)
  const dateProblem =
    paid < asOf ? 'The payment date cannot be earlier than the day the remittance covers.' : null
  const blocked = !shown || shown.blockers.length > 0 || !bankId || !!dateProblem || paid > today

  const post = async () => {
    setSaving(true)
    setError(null)
    const res = await TaxClosing.remitWht({
      asOf,
      paymentDate: paid,
      bankAccountId: bankId,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not post the remittance')
      return
    }
    router.push(`/accounting/tax-closing/${res.data.id}`)
  }

  const field = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'
  const lab = 'mb-1 block text-xs font-medium text-gray-600'

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href="/accounting/tax-closing"
        className="mb-3 inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tax Closing
      </Link>
      <h1 className="text-2xl font-bold text-prominent-purple-900">Remit withholding tax</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        Pays the expanded withholding tax the books owe the BIR as of the end of the day you choose,
        out of a bank account. Each withholding account is debited for what it holds and the bank is
        credited for the total.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className={lab}>Remit withholding through</span>
          <input
            type="date"
            aria-label="Remit through"
            value={asOf}
            max={today}
            onChange={(e) => setAsOf(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={lab}>Payment date</span>
          <input
            type="date"
            aria-label="Payment date"
            value={paid}
            min={asOf}
            max={today}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={lab}>Paid from</span>
          <select
            aria-label="Paid from"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            className={`${field} min-w-[220px]`}
          >
            <option value="">— Select a bank account —</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.bankName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={lab}>BIR payment reference</span>
          <input
            aria-label="Reference"
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            className={`${field} w-48`}
          />
        </label>
        {shown?.lastRemittedAsOf && (
          <div className="pb-2 text-[13px] text-gray-500">
            Last remitted through <b>{shown.lastRemittedAsOf}</b>
          </div>
        )}
      </div>
      {banksLoaded && banks.length === 0 && (
        <p className="mt-2 text-[13px] text-amber-800">
          There is no active bank account to pay from. Add one under Bank Accounts first.
        </p>
      )}

      {(error || dateProblem || (asOf && future)) && (
        <div
          data-testid="remit-error"
          className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {future && asOf ? 'Pick a day that has already happened.' : (error ?? dateProblem)}
        </div>
      )}

      {shown && (
        <>
          {shown.blockers.length > 0 && (
            <div
              data-testid="remit-blockers"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {shown.blockers.map((b) => (
                <div key={b}>{b}</div>
              ))}
            </div>
          )}

          <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
            What each account owes as of {shown.asOf}
          </h2>
          <div
            data-testid="remit-balances"
            className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Owed</th>
                </tr>
              </thead>
              <tbody>
                {shown.accounts.map((a) => (
                  <tr
                    key={a.accountId}
                    data-testid="remit-balance"
                    className="border-t border-gray-100"
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs font-semibold text-purple-700">
                        {a.number}
                      </span>
                      <span className="ml-2 text-gray-600">{a.name}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(a.balance)}
                      {a.balance < 0 && (
                        <div className="text-[11px] text-amber-700">
                          more was paid than withheld; left alone
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shown.lines.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
                The entry this will post, dated {paid}
              </h2>
              <EntryTable
                testId="remit-entry"
                lines={[
                  ...shown.lines.map((l) => ({
                    key: l.accountId,
                    account: l.number,
                    accountName: l.name,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit,
                  })),
                  {
                    key: 'bank',
                    account: bank ? 'Bank' : '—',
                    accountName: bank ? bank.name : 'Choose the bank account it is paid from',
                    description: 'Withholding tax remitted',
                    debit: 0,
                    credit: shown.total,
                  },
                ]}
              />
            </>
          )}

          <label className="mt-5 block max-w-xl">
            <span className={lab}>Notes (optional)</span>
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
              data-testid="post-remittance"
              onClick={post}
              disabled={blocked || saving || loading}
              className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Posting…' : `Post remittance of ${fmtMoney(shown.total)}`}
            </button>
            <Link
              href="/accounting/tax-closing"
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
