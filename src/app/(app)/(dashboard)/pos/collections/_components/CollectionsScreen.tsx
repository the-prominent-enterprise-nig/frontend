'use client'

import { useEffect, useState } from 'react'
import { Search, AlertTriangle, Banknote, CheckCircle2, Loader2, Users, X } from 'lucide-react'
import { useCustomerInstallmentSchedules, useCollectionsCustomers } from '../../_hooks/usePos'
import {
  getBranches,
  getPaymentMethods,
  getEnabledBranchPaymentMethods,
} from '../../_actions/pos-actions'
import { collectorsApi } from '@/src/libs/api/crm'
import { getSessionOrNull } from '@/src/libs/auth/actions/get-session'
import { BranchSearchCombobox } from './BranchSearchCombobox'
import { ARInvoices, fmtMoney, fmtDate, type PaymentMethod } from '@/src/libs/data/AccountingV2Data'
import type {
  PosCustomer,
  CollectionsCustomer,
  InstallmentScheduleLineWithInvoice,
  PaymentMethodConfig,
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

// Of POS's full configured-method set (cash, card, gcash, maya, gift_card,
// store_credit, loyalty_points, bank_transfer, tpf, qr, custom), only these
// map onto something that makes sense for paying down an AR due — the rest
// are POS-sale-specific tenders (gift card redemption, loyalty points, a
// financier settlement) with nothing equivalent in Collections.
const COLLECTIONS_METHOD_KEYS: Record<string, PaymentMethod> = {
  cash: 'CASH',
  card: 'CARD',
  bank_transfer: 'BANK_TRANSFER',
  qr: 'QR',
}

// 'Check' has no POS equivalent (not a PosPaymentMethod at all) — kept as a
// fixed extra choice alongside the branch's configured methods below, same
// as it's always worked in this form.
const CHECK_PAYMENT_OPTION: CollectionsPaymentOption = {
  id: 'CHECK',
  label: 'Check',
  method: 'CHECK',
  configId: undefined,
  options: [],
}

type CollectionsPaymentOption = {
  /** Select value — the PosPaymentMethodConfig id, or 'CHECK'. */
  id: string
  label: string
  method: PaymentMethod
  configId?: string
  /** Named sub-choices (which bank/gateway) — empty when the method has none. */
  options: { id: string; name: string }[]
}

// Same per-branch configured payment methods POS checkout uses (Scenario 37),
// narrowed to the subset that makes sense for Collections — see
// COLLECTIONS_METHOD_KEYS above. Mirrors checkout/page.tsx's own two-call
// composition (tenant-wide configs for metadata/options + branch-scoped
// enabled keys for gating) rather than introducing a third fetch pattern.
// Cash and Card are exempt from the branch-level gate below — a cashier
// should always be able to collect those two regardless of whether a branch
// remembered to explicitly enable them in payment method settings; only
// Bank Transfer/QR stay branch-gated.
function useCollectionsPaymentMethods(branchId: string): CollectionsPaymentOption[] {
  const [configured, setConfigured] = useState<PaymentMethodConfig[]>([])
  const [enabledKeys, setEnabledKeys] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    getPaymentMethods().then((res) => {
      if (!cancelled && res.success && res.data) setConfigured(res.data.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const request = branchId ? getEnabledBranchPaymentMethods(branchId) : Promise.resolve(null)
    request.then((res) => {
      if (cancelled) return
      setEnabledKeys(res?.success && res.data ? new Set(res.data) : null)
    })
    return () => {
      cancelled = true
    }
  }, [branchId])

  const configuredOptions = configured
    .filter((m) => m.isEnabled && m.key && m.key in COLLECTIONS_METHOD_KEYS)
    .filter((m) => !enabledKeys || m.key === 'cash' || m.key === 'card' || enabledKeys.has(m.key!))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(
      (m): CollectionsPaymentOption => ({
        id: m.id,
        label: m.label,
        method: COLLECTIONS_METHOD_KEYS[m.key!],
        configId: m.id,
        options: m.options.filter((o) => o.isEnabled),
      })
    )

  return [...configuredOptions, CHECK_PAYMENT_OPTION]
}

// A due is eligible for selection (and payment, via "Pay Selected") once
// it's past DRAFT (never posted) and hasn't been settled/voided — the same
// set MovementsTab et al. call "collectable".
function isEligibleForBulkPay(line: InstallmentScheduleLineWithInvoice): boolean {
  return !['DRAFT', 'CANCELLED', 'PAID'].includes(line.arInvoice.status)
}

// Shopee-style early-payment selection: checking a due auto-checks every
// earlier unpaid due on its schedule; unchecking one un-checks everything
// after it. This always resolves to a valid contiguous prefix client-side —
// one click for a K-line selection — matching how the backend's own
// earlierUnpaidLine check (ar-invoices.service.ts recordPaymentCore) is
// independently enforced regardless of what the UI allows.
function toggleLineSelection(
  scheduleLines: InstallmentScheduleLineWithInvoice[],
  line: InstallmentScheduleLineWithInvoice,
  selected: Set<string>
): Set<string> {
  const eligible = scheduleLines.filter(isEligibleForBulkPay)
  const idx = eligible.findIndex((l) => l.arInvoice.id === line.arInvoice.id)
  if (idx === -1) return selected
  const next = new Set(selected)
  if (!next.has(line.arInvoice.id)) {
    for (let i = 0; i <= idx; i++) next.add(eligible[i].arInvoice.id)
  } else {
    for (let i = idx; i < eligible.length; i++) next.delete(eligible[i].arInvoice.id)
  }
  return next
}

// Splits a bulk payment's Total/Rebate across the selected dues (given in
// due order) the same way the read-only defaults always implied: settle one
// due in full — its rebate capped at its own suggestedRebate, its amount
// capped at what it still needs — before any leftover Total/Rebate flows to
// the next due. Whatever's left once every due is fully covered lands on the
// last due as an overpayment (matching the backend's own per-line
// overpayment check), rather than being silently dropped.
function allocateBulkPayment(
  lines: { line: InstallmentScheduleLineWithInvoice; suggestedRebate: number | null }[],
  totalAmount: number,
  totalRebate: number
): { line: InstallmentScheduleLineWithInvoice; amount: number; rebateAmount: number }[] {
  let remainingAmount = Math.max(totalAmount, 0)
  let remainingRebate = Math.max(totalRebate, 0)
  return lines.map(({ line, suggestedRebate }, i) => {
    const outstanding = Math.max(line.arInvoice.totalAmount - line.arInvoice.amountPaid, 0)
    const cap = suggestedRebate ?? 0
    const rebateAmount = Math.round(Math.min(remainingRebate, cap) * 100) / 100
    remainingRebate = Math.max(Math.round((remainingRebate - rebateAmount) * 100) / 100, 0)
    const neededAmount = Math.max(Math.round((outstanding - rebateAmount) * 100) / 100, 0)
    const isLast = i === lines.length - 1
    const amount =
      Math.round((isLast ? remainingAmount : Math.min(remainingAmount, neededAmount)) * 100) / 100
    remainingAmount = Math.max(Math.round((remainingAmount - amount) * 100) / 100, 0)
    return { line, rebateAmount, amount }
  })
}

function CollectionsCustomerRow({
  customer,
  onSelect,
}: {
  customer: CollectionsCustomer
  onSelect: () => void
}) {
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
            <span className="ml-1 text-[11px] font-normal text-zinc-400">outstanding</span>
          </span>
          <span
            className={`block text-[12px] ${customer.dueAmount > 0 ? 'font-medium text-red-600' : 'text-zinc-500'}`}
          >
            {customer.dueAmount > 0 ? `${fmtMoney(customer.dueAmount)} due now` : 'Nothing due yet'}{' '}
            · next {fmtDate(customer.nextDueDate)}
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
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [showBulkPay, setShowBulkPay] = useState(false)

  const debouncedQuery = useDebounced(query, 300)
  const customersQuery = useCollectionsCustomers(branchId || undefined, debouncedQuery || undefined)
  const schedulesQuery = useCustomerInstallmentSchedules(customer?.id)

  const customers = customersQuery.data?.success ? (customersQuery.data.data ?? []) : []
  const schedules = schedulesQuery.data?.success ? (schedulesQuery.data.data ?? []) : []
  const selectedPayableLines = schedules.flatMap((s) =>
    s.lines
      .filter((l) => selectedInvoiceIds.has(l.arInvoice.id))
      .map((l) => ({
        line: l,
        suggestedRebate:
          s.installmentAccount?.ppd != null ? Number(s.installmentAccount.ppd) : null,
      }))
  )

  function selectCustomer(next: PosCustomer | null) {
    setCustomer(next)
    setSelectedInvoiceIds(new Set())
  }

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
                        selectCustomer({ id: c.id, name: c.name, phone: c.phone ?? undefined })
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
                onClick={() => selectCustomer(null)}
                className="text-[13px] font-medium text-prominent-purple-700 hover:underline"
              >
                Change customer
              </button>
            </div>

            {selectedPayableLines.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 px-5 py-3.5">
                <span className="text-[13px] text-prominent-purple-800">
                  {selectedPayableLines.length} due{selectedPayableLines.length !== 1 ? 's' : ''}{' '}
                  selected
                </span>
                <button
                  onClick={() => setShowBulkPay(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-prominent-purple-800"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Pay Selected ({selectedPayableLines.length})
                </button>
              </div>
            )}

            {schedulesQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading installment plans…
              </div>
            )}
            {!schedulesQuery.isLoading && schedules.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 shadow-sm">
                <Banknote className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">
                  No installment plans for this customer
                </p>
              </div>
            )}

            <div className="space-y-4">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-5 py-2.5 text-[13px] text-zinc-500">
                    <span className="font-mono">{s.posTransaction?.transactionNumber ?? s.id}</span>
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
                          const isEligible = isEligibleForBulkPay(line)
                          const isSelected = selectedInvoiceIds.has(line.arInvoice.id)
                          return (
                            <li
                              key={line.lineNumber}
                              className="flex items-center justify-between gap-3 px-5 py-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {isEligible && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedInvoiceIds((prev) =>
                                        toggleLineSelection(s.lines, line, prev)
                                      )
                                    }
                                    title={
                                      !isNextDue
                                        ? 'Selecting this also selects every earlier unpaid due — dues are settled in order.'
                                        : undefined
                                    }
                                    className="h-4 w-4 shrink-0 rounded border-zinc-300 text-prominent-purple-600 focus:ring-prominent-purple-500"
                                  />
                                )}
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

      {showBulkPay && (
        <CollectPaymentModal
          lines={selectedPayableLines}
          customerName={customer?.name}
          defaultBranchId={branchId || undefined}
          onClose={() => setShowBulkPay(false)}
          onCollected={async () => {
            await Promise.all([schedulesQuery.refetch(), customersQuery.refetch()])
            setSelectedInvoiceIds(new Set())
            setShowBulkPay(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Collects payment against whichever of a customer's installment dues are
 * checked below (Shopee-style "Pay Selected") — one due or several at once,
 * same shell/field set either way, both defaulting to paying every checked
 * due off in full. Amount/Total and Rebate are always editable; for a batch,
 * allocateBulkPayment() splits whatever's typed across the checked dues in
 * due order — settling one in full before any leftover flows to the next,
 * same order the defaults already imply — so a custom partial amount on an
 * earlier due still just means checking only that one. The CR number is
 * required in both modes — every collection cuts a collection receipt, and
 * a payment recorded without one can't be reconciled against the booklet.
 */
function CollectPaymentModal({
  lines,
  customerName,
  defaultBranchId,
  onClose,
  onCollected,
}: {
  lines: {
    line: InstallmentScheduleLineWithInvoice
    /** Suggested rebate (PPD) for this due, from the schedule's linked
     * InstallmentAccount — null if there's no linked account. */
    suggestedRebate: number | null
  }[]
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
  // Distinguishes the single-due UI (an "Outstanding" reference row) from
  // the batch UI (an itemized dues list) — both share the same editable
  // Amount/Total + Rebate fields below.
  const single = lines.length === 1 ? lines[0] : null
  const outstanding = single
    ? Math.max(single.line.arInvoice.totalAmount - single.line.arInvoice.amountPaid, 0)
    : 0
  // Defense-in-depth: the list view already hides the checkbox entirely for
  // a fully-paid due (see isEligibleForBulkPay), so this should be
  // unreachable in the normal flow — but if it is reached (stale list, race
  // with another cashier), hard-block submit here too instead of only
  // allowing it through as an overpayment.
  const isFullyPaid = single?.line.arInvoice.status === 'PAID'

  // Sums across every selected due — used for the rebate cap and for the
  // Total/Rebate fields' initial values (paying each due off in full is the
  // sensible starting point; the cashier can edit either field from there).
  const outstandingSum = lines.reduce(
    (sum, { line }) => sum + Math.max(line.arInvoice.totalAmount - line.arInvoice.amountPaid, 0),
    0
  )
  const rebateCapSum = lines.reduce((sum, { suggestedRebate }) => sum + (suggestedRebate ?? 0), 0)
  const outstandingTotal = single ? outstanding : outstandingSum
  const rebateCap = single ? (single.suggestedRebate ?? 0) : rebateCapSum

  const [form, setForm] = useState({
    // outstandingTotal/rebateCap are always valid non-negative numbers, so
    // this never needs a `|| ''` fallback — that idiom would blank the field
    // out for a legitimately-zero amount (0 is falsy). Nets out the
    // suggested rebate so accepting both defaults as-is settles the due(s)
    // exactly, rather than over-collecting (cash + rebate > owed).
    amount: String(Math.max(Math.round((outstandingTotal - rebateCap) * 100) / 100, 0)),
    withholdingAmount: '0',
    rebateAmount: String(rebateCap),
    paymentDate: todayIso(),
    paymentMethodConfigId: '',
    paymentMethodOptionId: '',
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
    overpaidCount: number
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

  const paymentMethods = useCollectionsPaymentMethods(form.branchId)
  // Falls through to Cash (same default this form always had) until the
  // cashier explicitly picks something else, or the branch's methods don't
  // include what they'd previously picked — derived at render rather than
  // synced into form state via an effect.
  const selectedPaymentMethod =
    paymentMethods.find((m) => m.id === form.paymentMethodConfigId) ??
    paymentMethods.find((m) => m.method === 'CASH') ??
    paymentMethods[0]

  const totalApplied =
    (Number(form.amount) || 0) +
    (Number(form.withholdingAmount) || 0) +
    (Number(form.rebateAmount) || 0)
  const wouldOverpay = totalApplied > outstandingTotal + 0.01
  const rebateExceedsCap = (Number(form.rebateAmount) || 0) > rebateCap + 0.01
  const isBackdatedOrPostdated = !isToday(form.paymentDate)
  // Informational only, not blocking — the backend only rejects a repeat
  // same-date payment once the invoice is already fully paid (isFullyPaid,
  // handled separately above). A due that's still open can be topped up
  // again on a date that already has a payment, so this just tells the
  // cashier that's what's about to happen.
  const alreadyPaidOnChosenDate = single ? hasPaymentOnDate(single.line, form.paymentDate) : false
  // Live per-due split of whatever's currently typed into Total/Rebate —
  // drives both the dues-list preview below and the actual bulk submit
  // payload, so what the cashier sees is exactly what gets recorded.
  const bulkAllocated = allocateBulkPayment(
    lines,
    Number(form.amount) || 0,
    Number(form.rebateAmount) || 0
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    if (single) {
      const res = await ARInvoices.recordPayment(single.line.arInvoice.id, {
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        withholdingAmount: Number(form.withholdingAmount || 0),
        rebateAmount: Number(form.rebateAmount || 0),
        method: selectedPaymentMethod?.method ?? 'CASH',
        paymentMethodConfigId: selectedPaymentMethod?.configId,
        paymentMethodOptionId: form.paymentMethodOptionId || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
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
        setOverpaymentResult({
          overpaidCount: 1,
          overpaidAmount: res.data.overpayment.overpaidAmount,
          wasClosedAccount: res.data.overpayment.wasClosedAccount,
        })
        return
      }
    } else {
      const res = await ARInvoices.recordBulkPayment({
        lines: bulkAllocated.map((p) => ({
          invoiceId: p.line.arInvoice.id,
          amount: p.amount,
          rebateAmount: p.rebateAmount,
        })),
        paymentDate: form.paymentDate,
        method: selectedPaymentMethod?.method ?? 'CASH',
        paymentMethodConfigId: selectedPaymentMethod?.configId,
        paymentMethodOptionId: form.paymentMethodOptionId || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        branchId: form.branchId || undefined,
        collectorId: form.collectorId || undefined,
      })
      if (!res.success) {
        setSubmitting(false)
        setError(res.message || res.error || 'Failed to collect payment')
        return
      }
      const overpaidPayments = (res.data?.payments ?? []).filter((p) => p.overpayment)
      if (overpaidPayments.length > 0) {
        setSubmitting(false)
        setOverpaymentResult({
          overpaidCount: overpaidPayments.length,
          overpaidAmount: overpaidPayments.reduce(
            (sum, p) => sum + (p.overpayment?.overpaidAmount ?? 0),
            0
          ),
          wasClosedAccount: overpaidPayments.some((p) => p.overpayment?.wasClosedAccount),
        })
        return
      }
    }
    // Stays "submitting" (spinner, buttons disabled) until the parent's
    // refetch actually lands — this component unmounts right after, so
    // there's nothing to reset setSubmitting(false) for on the success path.
    await onCollected()
  }

  if (overpaymentResult) {
    const { overpaidCount, overpaidAmount, wasClosedAccount } = overpaymentResult
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {single
                ? wasClosedAccount
                  ? 'Overpayment on a closed account'
                  : 'Payment recorded as an overpayment'
                : `${overpaidCount} payment${overpaidCount !== 1 ? 's' : ''} recorded as an overpayment`}
            </h3>
            <p className="text-sm text-zinc-600">
              {single ? (
                <>
                  This payment was <span className="font-semibold">not rejected</span> — it exceeds
                  what was owed by <span className="font-semibold">{fmtMoney(overpaidAmount)}</span>
                  .
                  {wasClosedAccount &&
                    ' This installment due was already fully paid before this payment.'}{' '}
                  A manager can cancel this specific payment from Accounting → AR Invoices if
                  needed.
                </>
              ) : (
                <>
                  This batch was <span className="font-semibold">not rejected</span> —{' '}
                  {overpaidCount} of the {lines.length} payments exceeded what was owed. A manager
                  can cancel any specific payment from Accounting → AR Invoices if needed.
                </>
              )}
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
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50">
              <Banknote className="h-5 w-5 text-prominent-purple-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {single ? 'Collect Payment' : 'Pay Selected Dues'}
              </h2>
              <p className="text-sm text-zinc-500">
                {customerName ?? 'Customer'} ·{' '}
                {single
                  ? `due ${fmtDate(single.line.arInvoice.dueDate)}`
                  : `${lines.length} due${lines.length !== 1 ? 's' : ''}`}
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
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            {single && isFullyPaid && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This due is already fully paid — any additional amount would be an overpayment, and
                this screen no longer allows recording one. If a correction is needed (e.g.
                reversing a mistaken payment), use Accounting → AR Invoices.
              </div>
            )}
            {single && !isFullyPaid && alreadyPaidOnChosenDate && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A payment was already collected
                for this due on {isToday(form.paymentDate) ? 'today' : fmtDate(form.paymentDate)}.
                This will be recorded as an additional payment toward the remaining balance.
              </div>
            )}
            {single && !isFullyPaid && !alreadyPaidOnChosenDate && isBackdatedOrPostdated && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This payment will be recorded for {fmtDate(form.paymentDate)}, not today — make sure
                that&apos;s intentional (e.g. entering a collection from a prior day).
              </div>
            )}

            {single ? (
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
                <span className="text-[13px] text-zinc-500">Outstanding</span>
                <span className="text-base font-semibold text-zinc-900">
                  {fmtMoney(outstanding)}
                </span>
              </div>
            ) : (
              // Reference only — the cashier may not end up giving the
              // rebate at all, so this shows both outcomes per due up
              // front rather than assuming it's applied. What actually
              // gets collected/submitted is whatever's typed into
              // Total/Rebate below (see bulkAllocated).
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2 font-medium">Due</th>
                      <th className="px-3 py-2 text-right font-medium">Without rebate</th>
                      <th className="px-3 py-2 text-right font-medium">Rebate</th>
                      <th className="px-3 py-2 text-right font-medium">With rebate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {lines.map(({ line, suggestedRebate }) => {
                      const dueOutstanding = Math.max(
                        line.arInvoice.totalAmount - line.arInvoice.amountPaid,
                        0
                      )
                      const cap = suggestedRebate ?? 0
                      const withRebate = Math.max(Math.round((dueOutstanding - cap) * 100) / 100, 0)
                      return (
                        <tr key={line.arInvoice.id}>
                          <td className="px-3 py-2 text-zinc-700">
                            Payment {line.lineNumber} · due {fmtDate(line.arInvoice.dueDate)}
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-500">
                            {fmtMoney(dueOutstanding)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-600">
                            {cap > 0 ? `−${fmtMoney(cap)}` : fmtMoney(0)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-zinc-900">
                            {fmtMoney(withRebate)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!single && rebateCapSum > 0 && (
              <p className="text-[12px] text-zinc-400">
                Rebate is about {((rebateCapSum / outstandingSum) * 100).toFixed(1)}% of the amount
                due.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  {single ? 'Amount received' : 'Total'} <span className="text-red-500">*</span>
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
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This exceeds the outstanding balance{single
                  ? ''
                  : ' across the selected dues'} by {fmtMoney(totalApplied - outstandingTotal)}. The
                extra will automatically apply toward the next unpaid due on this schedule — or be
                recorded as a flagged overpayment if there isn&apos;t one.
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
                {rebateCap
                  ? `Up to ${fmtMoney(rebateCap)} ${single ? 'for this account' : 'across the selected dues'}.`
                  : `No rebate available on ${single ? 'this due' : 'these dues'}.`}
              </p>
              {rebateExceedsCap && (
                <p className="mt-1 text-[12px] font-medium text-red-600">
                  Rebate can&apos;t exceed {fmtMoney(rebateCap)}{' '}
                  {single ? 'for this account' : 'across the selected dues'}.
                </p>
              )}
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
              <label className="mb-1 block text-sm font-medium text-zinc-700">Method</label>
              <select
                value={selectedPaymentMethod?.id ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paymentMethodConfigId: e.target.value,
                    paymentMethodOptionId: '',
                  })
                }
                className={fieldClass}
              >
                {paymentMethods.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedPaymentMethod && selectedPaymentMethod.options.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  {selectedPaymentMethod.label}
                </label>
                <select
                  value={form.paymentMethodOptionId}
                  onChange={(e) => setForm({ ...form, paymentMethodOptionId: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Select {selectedPaymentMethod.label.toLowerCase()}…</option>
                  {selectedPaymentMethod.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                CR number <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="CR number"
                className={fieldClass}
              />
              <p className="mt-1 text-[12px] text-zinc-400">
                Required — the CR number on the collection receipt issued for this payment.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              disabled={submitting || isFullyPaid || rebateExceedsCap || !form.reference.trim()}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting
                ? 'Collecting…'
                : single
                  ? 'Collect payment'
                  : `Pay ${fmtMoney(Number(form.amount) || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
