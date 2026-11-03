'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { installmentAccountsApi, type EarlyPayoffQuote } from '@/src/libs/api/crm'
import { earlyPayoffSchema } from '@/src/schema/crm/installment-account'
import type { InstallmentAccountDetail } from '@/src/schema/crm/types'
import {
  BankAccounts,
  PAYMENT_METHOD_OPTIONS,
  type BankAccountOption,
  type PaymentMethod,
} from '@/src/libs/data/AccountingV2Data'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

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

/** YYYY-MM-DD as e.g. "Oct 5, 2026". */
function longDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
  early_settlement_date_in_future: "The payment date can't be in the future.",
  early_settlement_date_too_early:
    "The payment date can't be before the sale or the account's last payment.",
}

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none'

/**
 * Scenario 79 — Settle Early, as its own page (it was a modal). The payoff
 * is the client's formula (ID ÷ Terms × MOS RUN + LCP − Total Paid), worked
 * out by the server as of the payment date and shown line by line; it isn't
 * typed. Settling collects it on a receipt like any payment and books the
 * interest it forgives as an early settlement credit memo.
 */
export default function SettleEarlyForm({ id }: { id: string }) {
  const router = useRouter()
  const accountHref = `/crm/installment-accounts/${id}`
  const [account, setAccount] = useState<InstallmentAccountDetail | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [paidAt, setPaidAt] = useState(manilaToday)
  const [quote, setQuote] = useState<EarlyPayoffQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  // Kept from the last quote that loaded, so the date picker stays bounded
  // while a refused date's quote shows its error.
  const [earliestDate, setEarliestDate] = useState<string | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(true)
  const [orNumber, setOrNumber] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [bankAccountId, setBankAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
      else setAccountError(res.error ?? 'Installment account not found')
    })
    BankAccounts.options().then((res) => setBankAccounts(res.data ?? []))
  }, [id])

  // MOS RUN counts the dues dated by the payment date, so the quote moves
  // with it.
  useEffect(() => {
    if (!paidAt) return
    let cancelled = false
    setLoadingQuote(true)
    setQuoteError(null)
    installmentAccountsApi.getEarlyPayoffQuote(id, paidAt).then((res) => {
      if (cancelled) return
      setLoadingQuote(false)
      if (res.success && res.data) {
        setQuote(res.data)
        setEarliestDate(res.data.earliestDate)
      } else {
        setQuote(null)
        const code = res.message ?? res.error ?? ''
        setQuoteError(SERVER_MESSAGES[code] ?? (res.error || 'Could not work out the payoff'))
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, paidAt])

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
      notes: notes.trim() || undefined,
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
    const res = await installmentAccountsApi.earlyPayoff(id, parsed.data)
    setSubmitting(false)
    if (res.success) {
      router.push(accountHref)
      router.refresh()
    } else {
      const code = res.message ?? res.error ?? ''
      setServerError(SERVER_MESSAGES[code] ?? (res.error || 'Failed to settle account'))
    }
  }

  const backLink = (
    <Link
      href={accountHref}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to installment account
    </Link>
  )

  if (accountError) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {backLink}
        <p className="text-red-600">{accountError}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      {backLink}

      <h1 className="text-2xl font-semibold text-gray-900">Settle account early</h1>
      <p className="mt-1 text-sm text-gray-500">
        {account ? (
          <>
            {account.accountNumber} · {account.customer.name}
          </>
        ) : (
          'Loading account…'
        )}
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="max-w-xs">
          <label htmlFor="payoff-paidAt" className="block text-[13px] font-medium text-gray-700">
            Payment date *
          </label>
          <input
            id="payoff-paidAt"
            type="date"
            value={paidAt}
            min={earliestDate ?? undefined}
            max={manilaToday()}
            onChange={(e) => setPaidAt(e.target.value)}
            className={INPUT_CLASS}
          />
          {earliestDate && (
            <p className="mt-1 text-[12px] text-gray-500">
              From {longDate(earliestDate)}, the sale or last payment, up to today.
            </p>
          )}
          {errors.paidAt && <p className="mt-1 text-[12px] text-red-600">{errors.paidAt}</p>}
        </div>

        {/* The payoff, line by line — ID ÷ Terms × MOS RUN + LCP − Total Paid */}
        <section
          aria-label="Payoff computation"
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-[13px]"
        >
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Payoff</h2>
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
                Months run counts the dues dated on or before the payment date ({quote.monthsRun} of{' '}
                {quote.termMonths}).
              </p>
            </dl>
          ) : null}
        </section>

        {blocked && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {BLOCKED_MESSAGES[blocked]}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              className={INPUT_CLASS}
            />
            {errors.orNumber && <p className="mt-1 text-[12px] text-red-600">{errors.orNumber}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Method *</label>
            <SearchableSelect
              value={method}
              onChange={(v) => {
                setMethod((v || 'CASH') as PaymentMethod)
                // A cash payoff isn't deposited anywhere yet.
                if (!v || v === 'CASH') setBankAccountId('')
              }}
              options={PAYMENT_METHOD_OPTIONS}
              className="mt-1 w-full"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[13px] font-medium text-gray-700">
              {requiresBank ? 'Deposited To *' : 'Deposited To'}
            </label>
            <SearchableSelect
              value={bankAccountId}
              onChange={setBankAccountId}
              options={bankAccounts.map((b) => ({
                value: b.id,
                label:
                  b.name === b.bankName
                    ? `${b.name} (${b.accountNumber})`
                    : `${b.name} — ${b.bankName} (${b.accountNumber})`,
              }))}
              placeholder={requiresBank ? 'Select a bank account' : 'Not tracked'}
              clearable
              className="mt-1 w-full"
            />
            {errors.bankAccountId && (
              <p className="mt-1 text-[12px] text-red-600">{errors.bankAccountId}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="payoff-notes" className="block text-[13px] font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="payoff-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        )}

        <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
          <Link
            href={accountHref}
            className="w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 sm:w-auto"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || loadingQuote || !quote || !!blocked}
            className="w-full rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Settling…' : quote ? `Settle for ${peso(quote.payoffAmount)}` : 'Settle'}
          </button>
        </div>
      </form>
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
