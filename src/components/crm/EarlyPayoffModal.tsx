'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { installmentAccountsApi, type EarlyPayoffQuote } from '@/src/libs/api/crm'
import { earlyPayoffSchema } from '@/src/schema/crm/installment-account'
import {
  BankAccounts,
  PAYMENT_METHOD_OPTIONS,
  type BankAccount,
  type PaymentMethod,
} from '@/src/libs/data/AccountingV2Data'

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Today in Manila, YYYY-MM-DD — the day the settlement is as of. */
function manilaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

const BLOCKED_MESSAGES: Record<NonNullable<EarlyPayoffQuote['blockedReason']>, string> = {
  unpaid_down_payment:
    "This account still has an unpaid down payment, which isn't on its invoice. Collect the down payment first, then settle.",
  no_receivable: 'This account has no AR invoice to settle against.',
  nothing_outstanding: 'Nothing is outstanding on this account.',
}

const SERVER_MESSAGES: Record<string, string> = {
  early_settlement_payoff_amount_mismatch:
    'The payoff changed since it was shown (a payment may have come in). Check the new amount and try again.',
  early_settlement_employee_appliance_loan:
    'An Employee Appliance Loan is settled through payroll deduction, not here.',
}

/**
 * Scenario 79 — Settle Early. The payoff is the client's own formula
 * (ID ÷ Terms × MOS RUN + LCP − Total Paid), worked out by the server as of
 * the payment date and shown here line by line; it isn't typed. Settling
 * collects it on a receipt like any payment and books the interest it
 * forgives as an early settlement credit memo.
 */
export default function EarlyPayoffModal({
  open,
  onClose,
  onSettled,
  accountId,
}: {
  open: boolean
  onClose: () => void
  onSettled?: () => void
  accountId: string
}) {
  const [paidAt, setPaidAt] = useState(manilaToday)
  const [quote, setQuote] = useState<EarlyPayoffQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [orNumber, setOrNumber] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
  }, [open])

  // MOS RUN counts the dues dated by the payment date, so the quote moves
  // with it.
  useEffect(() => {
    if (!open || !paidAt) return
    let cancelled = false
    setLoadingQuote(true)
    setQuoteError(null)
    installmentAccountsApi.getEarlyPayoffQuote(accountId, paidAt).then((res) => {
      if (cancelled) return
      setLoadingQuote(false)
      if (res.success && res.data) setQuote(res.data)
      else {
        setQuote(null)
        setQuoteError(res.error ?? 'Could not work out the payoff')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, accountId, paidAt])

  if (!open) return null

  const requiresBank = method !== 'CASH'
  const blocked = quote?.blockedReason ?? null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quote || blocked) return
    setServerError(null)
    const parsed = earlyPayoffSchema.safeParse({
      payoffAmount: quote.payoffAmount,
      paidAt,
      orNumber,
      method,
      bankAccountId: bankAccountId || undefined,
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await installmentAccountsApi.earlyPayoff(accountId, parsed.data)
    setSubmitting(false)
    if (res.success) {
      onSettled?.()
      onClose()
    } else {
      const code = res.message ?? res.error ?? ''
      setServerError(SERVER_MESSAGES[code] ?? (res.error || 'Failed to settle account'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settle account early</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="payoff-paidAt" className="block text-[13px] font-medium text-gray-700">
              Payment date *
            </label>
            <input
              id="payoff-paidAt"
              type="date"
              value={paidAt}
              max={manilaToday()}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.paidAt && <p className="mt-1 text-[12px] text-red-600">{errors.paidAt}</p>}
          </div>

          {/* The payoff, line by line — ID ÷ Terms × MOS RUN + LCP − Total Paid */}
          <section
            aria-label="Payoff computation"
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-[13px]"
          >
            {loadingQuote && !quote ? (
              <p className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Working out the payoff…
              </p>
            ) : quoteError ? (
              <p className="text-red-600">{quoteError}</p>
            ) : quote ? (
              <dl className={`space-y-1.5 ${loadingQuote ? 'opacity-60' : ''}`}>
                <Line label="Listed cash price (LCP)" value={peso(quote.listedCashPrice)} />
                <Line
                  label={`Interest (ID ${peso(quote.interestDifferential)} ÷ ${quote.termMonths} × ${quote.monthsRun} mos run)`}
                  value={`+ ${peso(quote.interestCharged)}`}
                />
                <Line
                  label="Total paid (down payment included)"
                  value={`− ${peso(quote.totalPaid)}`}
                />
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-[15px] font-semibold text-gray-900">
                  <dt>Payoff</dt>
                  <dd className="tabular-nums">{peso(quote.payoffAmount)}</dd>
                </div>
                <Line label="Balance on the account" value={peso(quote.receivable)} muted />
                <Line
                  label="Interest forgiven"
                  value={peso(quote.discount)}
                  muted
                  highlight={quote.discount > 0}
                />
                <p className="pt-1 text-[11px] text-gray-500">
                  Months run counts the dues dated on or before the payment date ({quote.monthsRun}{' '}
                  of {quote.termMonths}).
                </p>
              </dl>
            ) : null}
          </section>

          {blocked && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {BLOCKED_MESSAGES[blocked]}
            </p>
          )}

          <div>
            <label
              htmlFor="payoff-orNumber"
              className="block text-[13px] font-medium text-gray-700"
            >
              OR / CR number *
            </label>
            <input
              id="payoff-orNumber"
              value={orNumber}
              onChange={(e) => setOrNumber(e.target.value)}
              placeholder="e.g. CR#092398"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.orNumber && <p className="mt-1 text-[12px] text-red-600">{errors.orNumber}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payoff-method"
                className="block text-[13px] font-medium text-gray-700"
              >
                Method
              </label>
              <select
                id="payoff-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payoff-bank" className="block text-[13px] font-medium text-gray-700">
                {requiresBank ? 'Deposited To *' : 'Deposited To'}
              </label>
              <select
                id="payoff-bank"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{requiresBank ? '— Select —' : '— Not tracked —'}</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.bankName}
                  </option>
                ))}
              </select>
              {errors.bankAccountId && (
                <p className="mt-1 text-[12px] text-red-600">{errors.bankAccountId}</p>
              )}
            </div>
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingQuote || !quote || !!blocked}
              className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
            >
              {submitting
                ? 'Settling…'
                : quote
                  ? `Settle for ${peso(quote.payoffAmount)}`
                  : 'Settle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Line({
  label,
  value,
  muted,
  highlight,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={muted ? 'text-gray-500' : 'text-gray-700'}>{label}</dt>
      <dd
        className={`shrink-0 tabular-nums ${
          highlight ? 'font-medium text-emerald-700' : muted ? 'text-gray-500' : 'text-gray-900'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
