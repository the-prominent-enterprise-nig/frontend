'use client'

import { useEffect, useState } from 'react'
import { Search, AlertTriangle, Banknote, CheckCircle2, Loader2, Users, X } from 'lucide-react'
import { useCustomerInstallmentSchedules, useCollectionsCustomers } from '../../_hooks/usePos'
import { getBranches } from '../../_actions/pos-actions'
import { collectorsApi } from '@/src/libs/api/crm'
import { getSessionOrNull } from '@/src/libs/auth/actions/get-session'
import { BranchSearchCombobox } from './BranchSearchCombobox'
import {
  ARInvoices,
  fmtMoney,
  fmtDate,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from '@/src/libs/data/AccountingV2Data'
import type {
  PosCustomer,
  CollectionsCustomer,
  InstallmentScheduleLineWithInvoice,
} from '@/src/schema/pos'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  SENT: 'bg-zinc-100 text-zinc-600',
  DRAFT: 'bg-zinc-100 text-zinc-500',
  CANCELLED: 'bg-zinc-100 text-zinc-400',
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isToday(dateIso: string): boolean {
  return dateIso.slice(0, 10) === todayIso()
}

// Used to show an informational (non-blocking) note when the chosen payment
// date already has a payment recorded — the backend only actually rejects
// this once the invoice is fully paid (isFullyPaid, handled separately).
function hasPaymentOnDate(line: InstallmentScheduleLineWithInvoice, dateIso: string): boolean {
  return line.arInvoice.payments.some((p) => p.paymentDate.slice(0, 10) === dateIso.slice(0, 10))
}

// Debounces the raw input so the collections list doesn't refetch on every keystroke.
function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function CollectionsCustomerRow({
  customer,
  onSelect,
}: {
  customer: CollectionsCustomer
  onSelect: () => void
}) {
  const overdue = customer.outstandingCount > 0 && new Date(customer.nextDueDate) < new Date()
  return (
    <li>
      <button
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50 text-[13px] font-semibold text-prominent-purple-700">
            {customer.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-zinc-900">
              {customer.name}
            </span>
            {customer.phone && (
              <span className="block text-[12px] text-zinc-500">{customer.phone}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-semibold text-zinc-900">
            {fmtMoney(customer.outstandingAmount)}
          </span>
          <span
            className={`block text-[12px] ${overdue ? 'font-medium text-red-600' : 'text-zinc-500'}`}
          >
            {customer.outstandingCount} due · next {fmtDate(customer.nextDueDate)}
          </span>
        </span>
      </button>
    </li>
  )
}

function CustomerListSkeleton() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5 last:border-0"
        >
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-200" />
          <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  )
}

export default function CollectionsScreen() {
  const [query, setQuery] = useState('')
  const [branchId, setBranchId] = useState('')
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [collectingLine, setCollectingLine] = useState<{
    line: InstallmentScheduleLineWithInvoice
    // Suggested rebate (PPD) for this due — sourced from the parent
    // schedule's linked InstallmentAccount, since the line itself doesn't
    // carry it. Null when the schedule has no linked account.
    suggestedRebate: number | null
  } | null>(null)

  const debouncedQuery = useDebounced(query, 300)
  const customersQuery = useCollectionsCustomers(branchId || undefined, debouncedQuery || undefined)
  const schedulesQuery = useCustomerInstallmentSchedules(customer?.id)

  const customers = customersQuery.data?.success ? (customersQuery.data.data ?? []) : []

  return (
    <div className="min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Collections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Customers with an outstanding installment due — pick one to collect payment. Payments
            that exceed what&apos;s owed are recorded, not rejected, and flagged as an overpayment.
          </p>
        </div>

        {!customer ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by name or phone…"
                  className={`${fieldClass} pl-9`}
                />
              </div>
              <div className="sm:w-64">
                <BranchSearchCombobox
                  value={branchId}
                  onChange={setBranchId}
                  placeholder="All branches"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {customersQuery.isLoading ? (
                <CustomerListSkeleton />
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">
                    No customers with an outstanding due
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {query || branchId
                      ? 'Try clearing the filter.'
                      : 'Everyone is paid up — nothing to collect right now.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {customers.map((c) => (
                    <CollectionsCustomerRow
                      key={c.id}
                      customer={c}
                      onSelect={() =>
                        setCustomer({ id: c.id, name: c.name, phone: c.phone ?? undefined })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50 text-[13px] font-semibold text-prominent-purple-700">
                  {(customer.name || customer.firstName || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-zinc-900">
                    {customer.name ||
                      [customer.firstName, customer.lastName].filter(Boolean).join(' ')}
                  </div>
                  {customer.phone && (
                    <div className="text-[12px] text-zinc-500">{customer.phone}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="text-[13px] font-medium text-prominent-purple-700 hover:underline"
              >
                Change customer
              </button>
            </div>

            {schedulesQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading installment plans…
              </div>
            )}
            {!schedulesQuery.isLoading &&
              (!schedulesQuery.data?.success || (schedulesQuery.data.data ?? []).length === 0) && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 shadow-sm">
                  <Banknote className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">
                    No installment plans for this customer
                  </p>
                </div>
              )}

            <div className="space-y-4">
              {schedulesQuery.data?.success &&
                (schedulesQuery.data.data ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-5 py-2.5 text-[13px] text-zinc-500">
                      <span className="font-mono">
                        {s.posTransaction?.transactionNumber ?? s.id}
                      </span>
                      <span>
                        {s.termMonths} mo · Monthly {fmtMoney(s.monthlyInstallment)}
                      </span>
                    </div>
                    {(() => {
                      // Dues are settled in order — the earliest line that
                      // isn't PAID/CANCELLED yet is the only one collectible.
                      // Backed by a matching hard block server-side
                      // (ar-invoices.service.ts's recordPayment()), so this
                      // is UI convenience, not the only guard.
                      const nextDueLineNumber = s.lines.find(
                        (l) => !['PAID', 'CANCELLED'].includes(l.arInvoice.status)
                      )?.lineNumber
                      return (
                        <ul className="divide-y divide-zinc-100">
                          {s.lines.map((line) => {
                            // Fully paid dues can no longer be collected against
                            // at all through this screen — no more overpayment
                            // entry via a stray click here. A genuine correction
                            // (e.g. reversing a bad payment) goes through
                            // Accounting → AR Invoices instead.
                            const isFullyPaid = line.arInvoice.status === 'PAID'
                            const isNextDue = line.lineNumber === nextDueLineNumber
                            const collectable =
                              !['DRAFT', 'CANCELLED'].includes(line.arInvoice.status) &&
                              !isFullyPaid &&
                              isNextDue
                            return (
                              <li
                                key={line.lineNumber}
                                className="flex items-center justify-between gap-3 px-5 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="text-[13px] text-zinc-800">
                                    Payment {line.lineNumber} of {s.lines.length} · due{' '}
                                    {fmtDate(line.arInvoice.dueDate)}
                                  </div>
                                  <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                                    <StatusBadge status={line.arInvoice.status} />
                                    <span>
                                      {fmtMoney(line.arInvoice.amountPaid)} of{' '}
                                      {fmtMoney(line.arInvoice.totalAmount)} paid
                                    </span>
                                  </div>
                                </div>
                                {isFullyPaid && (
                                  <span
                                    title="This due is already fully paid — any additional amount would be an overpayment, and this screen no longer allows recording one. If a correction is needed (e.g. reversing a mistaken payment), use Accounting → AR Invoices."
                                    className="inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Paid
                                  </span>
                                )}
                                {collectable && (
                                  <button
                                    onClick={() =>
                                      setCollectingLine({
                                        line,
                                        // ppd comes over the wire as a string (Prisma Decimal JSON
                                        // serialization) — coerce explicitly, same convention this
                                        // codebase already uses for downPayment/floorPrice/minQty.
                                        suggestedRebate:
                                          s.installmentAccount?.ppd != null
                                            ? Number(s.installmentAccount.ppd)
                                            : null,
                                      })
                                    }
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                                  >
                                    <Banknote className="h-3.5 w-3.5" />
                                    Collect
                                  </button>
                                )}
                                {!isFullyPaid &&
                                  !isNextDue &&
                                  !['DRAFT', 'CANCELLED'].includes(line.arInvoice.status) && (
                                    <span
                                      title={
                                        nextDueLineNumber != null
                                          ? `Payment ${nextDueLineNumber} must be collected first — dues are settled in order.`
                                          : undefined
                                      }
                                      className="inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] font-semibold text-zinc-400"
                                    >
                                      <Banknote className="h-3.5 w-3.5" />
                                      Locked
                                    </span>
                                  )}
                              </li>
                            )
                          })}
                        </ul>
                      )
                    })()}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {collectingLine && (
        <CollectPaymentModal
          line={collectingLine.line}
          suggestedRebate={collectingLine.suggestedRebate}
          customerName={customer?.name}
          defaultBranchId={branchId || undefined}
          onClose={() => setCollectingLine(null)}
          onCollected={async () => {
            // Wait for both refetches before closing — otherwise the list
            // (and this due's own data, if reopened right away) can briefly
            // still reflect the pre-payment state. The modal's own submit
            // button stays in its spinner/disabled state for this whole
            // span (see CollectPaymentModal's onSubmit), so there's no
            // interactive-but-stale window for a fast click-through to hit.
            await Promise.all([schedulesQuery.refetch(), customersQuery.refetch()])
            setCollectingLine(null)
          }}
        />
      )}
    </div>
  )
}

function CollectPaymentModal({
  line,
  suggestedRebate,
  customerName,
  defaultBranchId,
  onClose,
  onCollected,
}: {
  line: InstallmentScheduleLineWithInvoice
  /** Suggested rebate (PPD) for this due, from the schedule's linked
   * InstallmentAccount — null if there's no linked account. */
  suggestedRebate: number | null
  customerName?: string
  /** Falls back to the Collections list's own branch filter, if the cashier
   * had one set — used only until the session's own branch resolves below. */
  defaultBranchId?: string
  onClose: () => void
  /** Async: resolves only once the parent's post-payment refetch has
   * actually landed, so the caller can keep the submit button's
   * spinner/disabled state up until the modal is genuinely safe to close. */
  onCollected: () => Promise<void>
}) {
  const invoice = line.arInvoice
  const outstanding = Math.max(invoice.totalAmount - invoice.amountPaid, 0)
  // Defense-in-depth: the list view already hides "Collect" entirely for a
  // fully-paid due (see isFullyPaid there), so this should be unreachable in
  // the normal flow — but if it is reached (stale list, race with another
  // cashier), hard-block submit here too instead of only allowing it through
  // as an overpayment.
  const isFullyPaid = invoice.status === 'PAID'
  const [form, setForm] = useState({
    // outstanding is always a valid non-negative number (Math.max(...) above),
    // so this never needs a `|| ''` fallback — that idiom would blank the
    // field out for a legitimately-zero outstanding balance (0 is falsy).
    // Nets out the suggested rebate so accepting both defaults as-is settles
    // the due exactly, rather than over-collecting (cash + rebate > owed).
    amount: String(Math.max(Math.round((outstanding - (suggestedRebate ?? 0)) * 100) / 100, 0)),
    withholdingAmount: '0',
    rebateAmount: String(suggestedRebate ?? 0),
    paymentDate: todayIso(),
    method: 'CASH' as PaymentMethod,
    reference: '',
    notes: '',
    branchId: '',
    collectorId: '',
  })
  // Resolved together (id + name) before ever touching form.branchId, so the
  // combobox's one-shot initialLabel is never stale — see BranchSearchCombobox's
  // key usage below for why this is a separate piece of state from form.branchId.
  const [branchDefault, setBranchDefault] = useState<{ id: string; name: string } | null>(null)
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentResult, setOverpaymentResult] = useState<{
    overpaidAmount: number
    wasClosedAccount: boolean
  } | null>(null)

  // A logged-in Cashier/Branch Manager is almost always collecting at their
  // own assigned branch — takes priority over the Collections list's own
  // branch filter (defaultBranchId), which only applies when the session
  // itself isn't tied to one branch (e.g. Business Owner).
  useEffect(() => {
    let cancelled = false
    Promise.all([getSessionOrNull(), getBranches()]).then(([session, branchesRes]) => {
      if (cancelled) return
      const targetId = session?.branchId || defaultBranchId
      const match = (branchesRes.data ?? []).find((b) => b.id === targetId)
      if (!match) return
      setBranchDefault({ id: match.id, name: match.name })
      setForm((f) => (f.branchId ? f : { ...f, branchId: match.id }))
    })
    return () => {
      cancelled = true
    }
  }, [defaultBranchId])

  // Collector options narrow to the chosen branch — refetch whenever it changes.
  useEffect(() => {
    collectorsApi
      .list({ limit: 200, ...(form.branchId ? { branchId: form.branchId } : {}) })
      .then((res) => {
        if (res.success && res.data) setCollectors(res.data.data)
      })
  }, [form.branchId])

  const totalApplied =
    (Number(form.amount) || 0) +
    (Number(form.withholdingAmount) || 0) +
    (Number(form.rebateAmount) || 0)
  const wouldOverpay = totalApplied > outstanding + 0.01
  const rebateExceedsCap = (Number(form.rebateAmount) || 0) > (suggestedRebate ?? 0) + 0.01
  const isBackdatedOrPostdated = !isToday(form.paymentDate)
  // Informational only, not blocking — the backend only rejects a repeat
  // same-date payment once the invoice is already fully paid (isFullyPaid,
  // handled separately above). A due that's still open can be topped up
  // again on a date that already has a payment, so this just tells the
  // cashier that's what's about to happen.
  const alreadyPaidOnChosenDate = hasPaymentOnDate(line, form.paymentDate)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await ARInvoices.recordPayment(invoice.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
      rebateAmount: Number(form.rebateAmount || 0),
      branchId: form.branchId || undefined,
      collectorId: form.collectorId || undefined,
    })
    if (!res.success) {
      setSubmitting(false)
      setError(res.message || res.error || 'Failed to collect payment')
      return
    }
    if (res.data?.overpayment) {
      setSubmitting(false)
      setOverpaymentResult(res.data.overpayment)
      return
    }
    // Stays "submitting" (spinner, buttons disabled) until the parent's
    // refetch actually lands — this component unmounts right after, so
    // there's nothing to reset setSubmitting(false) for on the success path.
    await onCollected()
  }

  if (overpaymentResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {overpaymentResult.wasClosedAccount
                ? 'Overpayment on a closed account'
                : 'Payment recorded as an overpayment'}
            </h3>
            <p className="text-sm text-zinc-600">
              This payment was <span className="font-semibold">not rejected</span> — it exceeds what
              was owed by{' '}
              <span className="font-semibold">{fmtMoney(overpaymentResult.overpaidAmount)}</span>.
              {overpaymentResult.wasClosedAccount &&
                ' This installment due was already fully paid before this payment.'}{' '}
              A manager can cancel this specific payment from Accounting → AR Invoices if needed.
            </p>
            <button
              onClick={onCollected}
              className="mt-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50">
              <Banknote className="h-5 w-5 text-prominent-purple-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Collect Payment</h2>
              <p className="text-sm text-zinc-500">
                {customerName ?? 'Customer'} · due {fmtDate(invoice.dueDate)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {isFullyPaid && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This due is already fully paid — any additional amount would be an overpayment, and
                this screen no longer allows recording one. If a correction is needed (e.g.
                reversing a mistaken payment), use Accounting → AR Invoices.
              </div>
            )}
            {!isFullyPaid && alreadyPaidOnChosenDate && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A payment was already collected
                for this due on {isToday(form.paymentDate) ? 'today' : fmtDate(form.paymentDate)}.
                This will be recorded as an additional payment toward the remaining balance.
              </div>
            )}
            {!isFullyPaid && !alreadyPaidOnChosenDate && isBackdatedOrPostdated && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This payment will be recorded for {fmtDate(form.paymentDate)}, not today — make sure
                that&apos;s intentional (e.g. entering a collection from a prior day).
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
              <span className="text-[13px] text-zinc-500">Outstanding</span>
              <span className="text-base font-semibold text-zinc-900">{fmtMoney(outstanding)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Amount received <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Payment date <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="date"
                  max={todayIso()}
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>
            {!isFullyPaid && wouldOverpay && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This exceeds the outstanding balance by {fmtMoney(totalApplied - outstanding)}. It
                will still be recorded and flagged as an overpayment.
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Rebate (Prompt Payment Discount)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.rebateAmount}
                onChange={(e) => setForm({ ...form, rebateAmount: e.target.value })}
                className={fieldClass}
              />
              <p className="mt-1 text-[12px] text-zinc-400">
                {suggestedRebate
                  ? `Up to ${fmtMoney(suggestedRebate)} for this account.`
                  : 'No rebate available on this due.'}
              </p>
              {rebateExceedsCap && (
                <p className="mt-1 text-[12px] font-medium text-red-600">
                  Rebate can&apos;t exceed {fmtMoney(suggestedRebate ?? 0)} for this account.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Method</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
                className={fieldClass}
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
              <BranchSearchCombobox
                key={branchDefault?.id ?? 'no-default'}
                value={form.branchId}
                onChange={(id) => setForm({ ...form, branchId: id, collectorId: '' })}
                initialLabel={branchDefault?.name}
                placeholder="Search branch…"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Collector</label>
              <select
                value={form.collectorId}
                onChange={(e) => setForm({ ...form, collectorId: e.target.value })}
                className={fieldClass}
              >
                <option value="">Walk-in / none</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.stubNumber} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reference</label>
              <input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="OR number"
                className={fieldClass}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isFullyPaid || rebateExceedsCap}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Collecting…' : 'Collect payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
