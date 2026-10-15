'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TaxClosing, type IncomeTaxPreview } from '@/src/libs/data/TaxReportsData'
import { BankAccounts, fmtMoney, type BankAccount } from '@/src/libs/data/AccountingV2Data'
import { manilaToday } from '@/src/libs/tax/tax-reports'
import EntryTable from '../../../_components/EntryTable'

// Close the income tax for a quarter or year. The tax due is the CPA's figure
// from the return; what the books add is the Creditable Withholding Tax they
// hold, the BIR Form 2307 certificates behind it, and any tax already provided.
// The credit applied is capped at the certificates received, so what is claimed
// agrees with the 2307 schedule shown here.
const QUARTERS = [
  { value: '', label: 'Annual return' },
  { value: '1', label: 'Q1' },
  { value: '2', label: 'Q2' },
  { value: '3', label: 'Q3' },
  { value: '4', label: 'Q4' },
]

export default function IncomeTaxClosingForm() {
  const router = useRouter()
  const today = manilaToday()
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [quarter, setQuarter] = useState('')
  const [asOf, setAsOf] = useState(today)
  const [taxDue, setTaxDue] = useState('')
  const [cwtApplied, setCwtApplied] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [bankId, setBankId] = useState('')
  const [reference, setReference] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [banksLoaded, setBanksLoaded] = useState(false)
  const [preview, setPreview] = useState<IncomeTaxPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    BankAccounts.list().then((r) => {
      setBanks((r.success && r.data ? r.data : []).filter((b) => b.isActive))
      setBanksLoaded(true)
    })
  }, [])

  const paid = paymentDate || asOf
  const due = Number(taxDue) || 0
  const credit = Number(cwtApplied) || 0
  const yearNumber = Number(taxYear)
  const future = !asOf || asOf > today
  const yearOk = Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 2100

  useEffect(() => {
    if (future || !yearOk) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await TaxClosing.previewIncomeTax({
        asOf,
        taxYear: yearNumber,
        taxQuarter: quarter ? Number(quarter) : undefined,
        taxDue: due,
        cwtApplied: credit,
      })
      if (cancelled) return
      if (res.success && res.data) {
        setPreview(res.data)
        setError(null)
      } else {
        setPreview(null)
        setError(res.message || res.error || 'Could not read the balances')
      }
      setLoading(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [asOf, yearNumber, yearOk, quarter, due, credit, future])

  const shown = future || !yearOk ? null : preview
  const bank = banks.find((b) => b.id === bankId)
  const needsBank = !!shown && shown.cashDue >= 0.005
  const dateProblem =
    paid < asOf ? 'The payment date cannot be earlier than the last day of the period.' : null
  const blocked =
    !shown ||
    shown.blockers.length > 0 ||
    (needsBank && !bankId) ||
    !reference.trim() ||
    !approvedBy.trim() ||
    !!dateProblem ||
    paid > today

  const post = async () => {
    setSaving(true)
    setError(null)
    const res = await TaxClosing.settleIncomeTax({
      asOf,
      taxYear: yearNumber,
      taxQuarter: quarter ? Number(quarter) : undefined,
      taxDue: due,
      cwtApplied: credit,
      paymentDate: paid,
      bankAccountId: needsBank ? bankId : undefined,
      reference: reference.trim(),
      approvedBy: approvedBy.trim(),
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not post the closing')
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
      <h1 className="text-2xl font-bold text-prominent-purple-900">Close income tax</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        Settles the income tax due on a quarterly or annual return. The Creditable Withholding Tax
        the BIR Form 2307 certificates support is applied against it, and whatever is left is paid
        from a bank. Tax already provided into Income Tax Payable is settled first; only the rest is
        charged to Income Tax Expense.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className={lab}>Taxable year</span>
          <input
            type="number"
            aria-label="Taxable year"
            value={taxYear}
            min={2000}
            max={2100}
            onChange={(e) => setTaxYear(e.target.value)}
            className={`${field} w-28`}
          />
        </label>
        <label className="block">
          <span className={lab}>Return</span>
          <select
            aria-label="Return"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className={field}
          >
            {QUARTERS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={lab}>Last day of the period</span>
          <input
            type="date"
            aria-label="Period end"
            value={asOf}
            max={today}
            onChange={(e) => setAsOf(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className={lab}>Income tax due on the return</span>
          <input
            type="number"
            aria-label="Tax due"
            min={0}
            step="0.01"
            value={taxDue}
            onChange={(e) => setTaxDue(e.target.value)}
            className={`${field} w-44 text-right`}
          />
        </label>
        <label className="block">
          <span className={lab}>CWT applied as a tax credit</span>
          <input
            type="number"
            aria-label="CWT applied"
            min={0}
            step="0.01"
            value={cwtApplied}
            onChange={(e) => setCwtApplied(e.target.value)}
            className={`${field} w-44 text-right`}
          />
        </label>
      </div>

      {(error || dateProblem || (asOf && future)) && (
        <div
          data-testid="income-tax-error"
          className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {future && asOf ? 'Pick a day that has already happened.' : (error ?? dateProblem)}
        </div>
      )}

      {shown && (
        <>
          {shown.blockers.length > 0 && (
            <div
              data-testid="income-tax-blockers"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {shown.blockers.map((b) => (
                <div key={b}>{b}</div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
            <Fact
              label="Creditable Withholding Tax on the books"
              value={fmtMoney(shown.accounts.cwt?.balance ?? 0)}
            />
            <Fact
              label="Supported by a received 2307"
              value={fmtMoney(shown.certificates.received)}
            />
            <Fact
              label="Claimable now"
              value={fmtMoney(shown.certificates.claimable)}
              hint={
                shown.certificates.alreadyApplied > 0
                  ? `${fmtMoney(shown.certificates.alreadyApplied)} already applied by earlier closings`
                  : undefined
              }
              testId="claimable"
            />
            <Fact
              label="Withheld, certificate still pending"
              value={fmtMoney(shown.certificates.pending)}
            />
            <Fact
              label="Income tax payable already provided"
              value={fmtMoney(shown.accounts.payable?.balance ?? 0)}
            />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
            The 2307 schedule behind the credit
          </h2>
          <div
            data-testid="cwt-schedule"
            className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">2307 no.</th>
                  <th className="px-3 py-2 text-left">ATC</th>
                  <th className="px-3 py-2 text-right">Withheld</th>
                  <th className="px-3 py-2 text-left">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {shown.certificates.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                      No customer has withheld tax as of this day.
                    </td>
                  </tr>
                ) : (
                  shown.certificates.rows.map((r, i) => (
                    <tr key={`${r.invoiceNumber}-${i}`} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-2">{r.paymentDate}</td>
                      <td className="px-3 py-2">{r.customerName ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.invoiceNumber ?? '—'}</td>
                      <td className="px-3 py-2">{r.certificateNo ?? '—'}</td>
                      <td className="px-3 py-2">{r.atc ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                      <td className="px-3 py-2">
                        {r.status === 'received' ? (
                          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                            Received
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {shown.certificates.truncated && (
            <p className="mt-1 text-[12px] text-gray-500">Showing the most recent 300.</p>
          )}

          {shown.lines.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">
                The entry this will post, dated {paid}
              </h2>
              <EntryTable
                testId="income-tax-entry"
                lines={[
                  ...shown.lines.map((l) => ({
                    key: l.accountId,
                    account: l.number,
                    accountName: l.name,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit,
                  })),
                  ...(needsBank
                    ? [
                        {
                          key: 'bank',
                          account: bank ? 'Bank' : '—',
                          accountName: bank ? bank.name : 'Choose the bank account it is paid from',
                          description: 'Income tax paid',
                          debit: 0,
                          credit: shown.cashDue,
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-4">
            {needsBank && (
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
            )}
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
              <span className={lab}>Return / BIR payment reference</span>
              <input
                aria-label="Reference"
                value={reference}
                maxLength={100}
                onChange={(e) => setReference(e.target.value)}
                className={`${field} w-56`}
              />
            </label>
            <label className="block">
              <span className={lab}>Approved by (CPA / approver)</span>
              <input
                aria-label="Approved by"
                value={approvedBy}
                maxLength={255}
                onChange={(e) => setApprovedBy(e.target.value)}
                className={`${field} w-64`}
              />
            </label>
          </div>
          {needsBank && banksLoaded && banks.length === 0 && (
            <p className="mt-2 text-[13px] text-amber-800">
              There is no active bank account to pay from. Add one under Bank Accounts first.
            </p>
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
              data-testid="post-income-tax"
              onClick={post}
              disabled={blocked || saving || loading}
              className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Posting…' : `Post closing of ${fmtMoney(shown.taxDue)}`}
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

function Fact({
  label,
  value,
  hint,
  testId,
}: {
  label: string
  value: string
  hint?: string
  testId?: string
}) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div data-testid={testId} className="mt-0.5 text-sm font-semibold text-gray-900">
        {value}
      </div>
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </div>
  )
}
