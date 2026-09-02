'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  InstallmentSchedule,
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
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

// A due is still collectible once it's past DRAFT (never posted) and hasn't
// been settled/voided — dues are always settled in schedule order, so the
// first of these on a schedule is the only one a payment can ever target;
// the backend hard-enforces this too (ar-invoices.service.ts's
// earlierUnpaidLine check).
function isOpenDue(line: InstallmentScheduleLineWithInvoice): boolean {
  return !['DRAFT', 'CANCELLED', 'PAID'].includes(line.arInvoice.status)
}

type CoverageStep = {
  line: InstallmentScheduleLineWithInvoice
  applied: number
  rebateApplied: number
  outstanding: number
  remainingAfter: number
}

// Pure client-side preview of how a lump sum + rebate get split across a
// schedule's still-open dues, in order — mirrors what recordBulkPayment()
// (ar-invoices.service.ts) actually settles once submitted (each due's own
// applyPaymentWithOverflow() call independently caps its rebate at the
// account's ppd, so a rebate scales with how many months this payment
// covers rather than being pinned to just the first due). Display only —
// the backend is the actual source of truth once submitted.
function computeCoveragePreview(
  lines: InstallmentScheduleLineWithInvoice[],
  amount: number,
  rebate: number,
  rebateCapPerLine: number
): CoverageStep[] {
  const steps: CoverageStep[] = []
  let cash = Math.max(round2(amount), 0)
  let rebateLeft = Math.max(round2(rebate), 0)
  for (const line of lines) {
    const outstanding = Math.max(round2(line.arInvoice.totalAmount - line.arInvoice.amountPaid), 0)
    if (outstanding <= 0) continue
    const rebateHere = Math.min(rebateLeft, rebateCapPerLine, outstanding)
    rebateLeft = round2(rebateLeft - rebateHere)
    const capacity = Math.max(round2(outstanding - rebateHere), 0)
    const applied = Math.min(cash, capacity)
    cash = round2(cash - applied)
    steps.push({
      line,
      applied,
      rebateApplied: rebateHere,
      outstanding,
      remainingAfter: Math.max(round2(capacity - applied), 0),
    })
    if (cash <= 0.004) break
  }
  return steps
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkHandled = useRef(false)

  const [query, setQuery] = useState('')
  const [branchId, setBranchId] = useState('')
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [payModalTarget, setPayModalTarget] = useState<InstallmentSchedule | null>(null)
  const [pendingScheduleId, setPendingScheduleId] = useState<string | null>(null)

  const debouncedQuery = useDebounced(query, 300)
  const customersQuery = useCollectionsCustomers(branchId || undefined, debouncedQuery || undefined)
  const schedulesQuery = useCustomerInstallmentSchedules(customer?.id)

  const customers = customersQuery.data?.success ? (customersQuery.data.data ?? []) : []
  const schedules = schedulesQuery.data?.success ? (schedulesQuery.data.data ?? []) : []

  function selectCustomer(next: PosCustomer | null) {
    setCustomer(next)
    setPayModalTarget(null)
  }

  // Deep link from a plan's due-date row (Customer360's Installment Plan
  // Detail modal) — pre-selects the customer and, once schedules load, opens
  // the Collect Payment modal for the specific schedule that was clicked.
  // The query string is cleared right after so a refresh/back-navigation
  // doesn't re-trigger it.
  useEffect(() => {
    if (deepLinkHandled.current) return
    const dlCustomerId = searchParams.get('customerId')
    if (!dlCustomerId) return
    deepLinkHandled.current = true
    selectCustomer({ id: dlCustomerId, name: searchParams.get('customerName') || 'Customer' })
    const dlScheduleId = searchParams.get('scheduleId')
    if (dlScheduleId) setPendingScheduleId(dlScheduleId)
    router.replace('/pos/collections')
  }, [searchParams, router])

  useEffect(() => {
    if (!pendingScheduleId || schedulesQuery.isLoading) return
    const match = schedules.find((s) => s.id === pendingScheduleId)
    if (match && match.lines.some(isOpenDue)) setPayModalTarget(match)
    setPendingScheduleId(null)
  }, [pendingScheduleId, schedules, schedulesQuery.isLoading])

  return (
    <div className="min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Collections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Customers with an outstanding installment due — pick one to collect payment. Enter one
            amount and it settles as many upcoming dues as it covers, in order; anything left over
            after every due is settled is recorded as a flagged overpayment rather than rejected.
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
              {schedules.map((s) => {
                const openLines = s.lines.filter(isOpenDue)
                return (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-5 py-2.5 text-[13px] text-zinc-500">
                      <span className="font-mono">
                        {s.posTransaction?.transactionNumber ?? s.id}
                      </span>
                      <div className="flex items-center gap-3">
                        <span>
                          {s.termMonths} mo · Monthly {fmtMoney(s.monthlyInstallment)}
                        </span>
                        {openLines.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPayModalTarget(s)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-prominent-purple-800"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Collect Payment
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="divide-y divide-zinc-100">
                      {s.lines.map((line) => (
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
                          {line.arInvoice.status === 'PAID' && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Paid
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {payModalTarget && (
        <CollectPaymentModal
          lines={payModalTarget.lines.filter(isOpenDue)}
          suggestedRebate={
            payModalTarget.installmentAccount?.ppd != null
              ? Number(payModalTarget.installmentAccount.ppd)
              : null
          }
          customerName={customer?.name}
          defaultBranchId={branchId || undefined}
          onClose={() => setPayModalTarget(null)}
          onCollected={async () => {
            await Promise.all([schedulesQuery.refetch(), customersQuery.refetch()])
            setPayModalTarget(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Collects a single lump-sum amount against a schedule's earliest unpaid
 * due. No term/due picker — the cashier just enters what the customer
 * handed over; the backend's own overflow cascade
 * (applyPaymentWithOverflow(), ar-invoices.service.ts) settles as many
 * upcoming dues as that amount covers, in schedule order, leaving the next
 * one PARTIAL if it doesn't divide evenly. `lines` is every still-open due
 * on the schedule, in order — used to render a live preview of that
 * cascade — but the payment is always submitted against `lines[0]`, the
 * only one collectible right now.
 */
function CollectPaymentModal({
  lines,
  suggestedRebate,
  customerName,
  defaultBranchId,
  onClose,
  onCollected,
}: {
  lines: InstallmentScheduleLineWithInvoice[]
  /** This schedule's linked InstallmentAccount PPD, if any — the rebate
   * cap, which always applies only to the first (earliest unpaid) due. */
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
  const target = lines[0]
  // A rebate belongs to whichever due it's collected against, capped at the
  // account's ppd per due (backend-enforced, ar-invoices.service.ts) — so a
  // lump sum covering several months can claim ppd on each of them, not
  // just the first.
  const rebateCapPerLine = suggestedRebate ?? 0
  const rebateCap = round2(rebateCapPerLine * lines.length)
  // The whole remaining balance on this schedule — a payment can legally
  // reach past the immediate next due, so "would this overpay" has to be
  // judged against everything still open, not just the first due.
  const outstandingTotal = lines.reduce(
    (sum, line) =>
      sum + Math.max(round2(line.arInvoice.totalAmount - line.arInvoice.amountPaid), 0),
    0
  )

  const [form, setForm] = useState({
    // Left blank rather than pre-filled — the cashier types exactly what the
    // customer handed over, and the preview below shows how far it reaches.
    amount: '',
    withholdingAmount: '0',
    rebateAmount: '',
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

  const enteredAmount = Number(form.amount) || 0
  const enteredRebate = Number(form.rebateAmount) || 0
  const totalApplied = enteredAmount + (Number(form.withholdingAmount) || 0) + enteredRebate
  const wouldOverpay = totalApplied > outstandingTotal + 0.01
  const rebateExceedsCap = enteredRebate > rebateCap + 0.01
  const isBackdatedOrPostdated = !isToday(form.paymentDate)
  // Informational only, not blocking — the backend only rejects a repeat
  // same-date payment once the invoice is already fully paid, which can't
  // happen here since `target` is always the earliest still-open due.
  const alreadyPaidOnChosenDate = target ? hasPaymentOnDate(target, form.paymentDate) : false
  const coverage = computeCoveragePreview(lines, enteredAmount, enteredRebate, rebateCapPerLine)
  const fullyCovered = coverage.filter((c) => c.applied > 0 && c.remainingAfter <= 0.004)
  const partialStep = coverage.find((c) => c.remainingAfter > 0.004)
  const fullyCoveredTotal = fullyCovered.reduce((sum, c) => sum + c.applied, 0)
  const fullyCoveredRebate = fullyCovered.reduce((sum, c) => sum + c.rebateApplied, 0)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Each covered due gets its own recordPayment() call server-side (so its
    // own rebate independently caps at ppd) — recordBulkPayment() runs them
    // all in one transaction/one journal entry, same as the old "Pay
    // Selected" flow, just with the dues chosen by the amount instead of by
    // hand.
    const payableLines = coverage.filter((c) => c.applied > 0)
    if (payableLines.length === 0) return
    setSubmitting(true)
    setError(null)

    const res = await ARInvoices.recordBulkPayment({
      lines: payableLines.map((c) => ({
        invoiceId: c.line.arInvoice.id,
        amount: c.applied,
        rebateAmount: c.rebateApplied,
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
    // Stays "submitting" (spinner, buttons disabled) until the parent's
    // refetch actually lands — this component unmounts right after, so
    // there's nothing to reset setSubmitting(false) for on the success path.
    await onCollected()
  }

  if (!target) return null

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
              {wasClosedAccount
                ? 'Overpayment on a closed account'
                : `${overpaidCount} payment${overpaidCount !== 1 ? 's' : ''} recorded as an overpayment`}
            </h3>
            <p className="text-sm text-zinc-600">
              This payment was <span className="font-semibold">not rejected</span> — it exceeds what
              was owed across every remaining due on this schedule by{' '}
              <span className="font-semibold">{fmtMoney(overpaidAmount)}</span>.
              {wasClosedAccount &&
                ' This installment plan was already fully paid before this payment.'}{' '}
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
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-purple-50">
              <Banknote className="h-5 w-5 text-prominent-purple-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Collect Payment</h2>
              <p className="text-sm text-zinc-500">
                {customerName ?? 'Customer'} · next due {fmtDate(target.arInvoice.dueDate)} ·{' '}
                {lines.length} due{lines.length !== 1 ? 's' : ''} remaining
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
            {alreadyPaidOnChosenDate && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A payment was already collected
                for this due on {isToday(form.paymentDate) ? 'today' : fmtDate(form.paymentDate)}.
                This will be recorded as an additional payment toward the remaining balance.
              </div>
            )}
            {!alreadyPaidOnChosenDate && isBackdatedOrPostdated && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This payment will be recorded for {fmtDate(form.paymentDate)}, not today — make sure
                that&apos;s intentional (e.g. entering a collection from a prior day).
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
              <span className="text-[13px] text-zinc-500">Outstanding on this plan</span>
              <span className="text-base font-semibold text-zinc-900">
                {fmtMoney(outstandingTotal)}
              </span>
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
                  placeholder="0.00"
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

            {/* Live preview of the backend's overflow cascade — no term
                picker, the amount alone decides how far this reaches. Fully
                covered dues collapse into one summary line rather than
                listing every one of them out. */}
            {enteredAmount > 0 && coverage.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px]">
                {fullyCovered.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-700">
                      {fullyCovered.length === 1
                        ? `Payment ${fullyCovered[0].line.lineNumber} paid in full`
                        : `Payments ${fullyCovered[0].line.lineNumber}–${fullyCovered[fullyCovered.length - 1].line.lineNumber} paid in full`}
                      {fullyCoveredRebate > 0 && (
                        <span className="text-[12px] text-zinc-400">
                          {' '}
                          (incl. {fmtMoney(fullyCoveredRebate)} rebate)
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-emerald-600">
                      {fmtMoney(fullyCoveredTotal + fullyCoveredRebate)}
                    </span>
                  </div>
                )}
                {partialStep && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-700">
                      Payment {partialStep.line.lineNumber} · due{' '}
                      {fmtDate(partialStep.line.arInvoice.dueDate)}
                    </span>
                    <span className="font-semibold text-amber-600">
                      {fmtMoney(partialStep.applied + partialStep.rebateApplied)} of{' '}
                      {fmtMoney(partialStep.outstanding)} — {fmtMoney(partialStep.remainingAfter)}{' '}
                      remaining
                    </span>
                  </div>
                )}
              </div>
            )}

            {wouldOverpay && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This exceeds every remaining due on this plan by{' '}
                {fmtMoney(totalApplied - outstandingTotal)}. It will be recorded as a flagged
                overpayment rather than rejected.
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
                placeholder="0.00"
                value={form.rebateAmount}
                onChange={(e) => setForm({ ...form, rebateAmount: e.target.value })}
                className={fieldClass}
              />
              <p className="mt-1 text-[12px] text-zinc-400">
                {rebateCapPerLine
                  ? `Up to ${fmtMoney(rebateCapPerLine)} per month covered — ${fmtMoney(rebateCap)} max across every remaining due.`
                  : 'No rebate available on this account.'}
              </p>
              {rebateExceedsCap && (
                <p className="mt-1 text-[12px] font-medium text-red-600">
                  Rebate can&apos;t exceed {fmtMoney(rebateCap)}.
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
                Reference {form.collectorId && <span className="text-red-500">*</span>}
              </label>
              <input
                required={!!form.collectorId}
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="OR number"
                className={fieldClass}
              />
              {form.collectorId ? (
                <p className="mt-1 text-[12px] text-zinc-400">
                  Required — the OR the collector wrote out for this payment.
                </p>
              ) : (
                <p className="mt-1 text-[12px] text-zinc-400">
                  Optional for a walk-in payment with no collector on hand to cut an OR.
                </p>
              )}
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
              disabled={
                submitting || rebateExceedsCap || (!!form.collectorId && !form.reference.trim())
              }
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
