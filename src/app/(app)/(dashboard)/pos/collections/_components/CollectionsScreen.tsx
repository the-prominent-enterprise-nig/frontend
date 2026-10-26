'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Users,
} from 'lucide-react'
import {
  useCustomerInstallmentSchedules,
  useCollectionsCustomers,
  useSessions,
} from '../../_hooks/usePos'
import {
  getBranches,
  getPaymentMethods,
  getEnabledBranchPaymentMethods,
} from '../../_actions/pos-actions'
import { getSessionIfAvailable } from '@/src/libs/auth/actions/get-session'
import { useMe } from '@/src/hooks/useMe'
import { BranchSearchCombobox } from './BranchSearchCombobox'
import CollectionPaymentBlock from './CollectionPaymentBlock'
import { nextTender } from '../../checkout/_utils/mixed-payment'
import {
  availableTiles,
  collectionIssues,
  newCollectionPaymentRow,
  resolveCollectionPayment,
  type CollectionIssueField,
  type CollectionPaymentRow,
  type CollectionsPaymentOption,
} from '../_utils/collection-tenders'
import { ARInvoices, fmtMoney, fmtDate, type PaymentMethod } from '@/src/libs/data/AccountingV2Data'
import type {
  PosCustomer,
  CollectionsCustomer,
  InstallmentScheduleLineWithInvoice,
  PaymentMethodConfig,
} from '@/src/schema/pos'
import {
  DUE_STATUS_LABELS,
  dueOutstanding,
  dueStatus,
  isDueOpen,
  todayIso,
} from '@/src/libs/pos/installment-dues'

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
      {DUE_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function isToday(dateIso: string): boolean {
  return dateIso.slice(0, 10) === todayIso()
}

// Used to show an informational (non-blocking) note when the chosen payment
// date already has a payment recorded — the backend only actually rejects
// this once the due is fully settled (isFullyPaid, handled separately).
// Plan-wide, not per-due: payments hang off the shared invoice.
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

// A due is eligible for selection (and payment, via "Pay Selected") once its
// contract is past DRAFT (never posted) and not voided, and the due itself
// hasn't been settled yet.
//
// An Employee Appliance Loan is never eligible: it is settled by payroll
// deduction, so Collections lists it but offers no way to pay it here.
const isEligibleForBulkPay = (line: InstallmentScheduleLineWithInvoice) =>
  isDueOpen(line) && !line.arInvoice.isEmployeeApplianceLoan

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
  // Keyed by the DUE's own id: every due of a plan shares one arInvoice.id,
  // so keying on that made checking any one month check all twelve.
  const idx = eligible.findIndex((l) => l.id === line.id)
  if (idx === -1) return selected
  const next = new Set(selected)
  if (!next.has(line.id)) {
    for (let i = 0; i <= idx; i++) next.add(eligible[i].id)
  } else {
    for (let i = idx; i < eligible.length; i++) next.delete(eligible[i].id)
  }
  return next
}

// The AR service reports these guards as bare codes, deliberately — they are
// an API contract its own e2e specs assert on. This screen is where a cashier
// reads them, so translate them here rather than leaking "rebate_exceeds_ppd"
// into the dialog. Anything unmapped falls through to the server's own text.
const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  rebate_exceeds_ppd:
    'The rebate is more than the prompt payment discount these dues have earned. A due only earns its PPD once the payment covers it in full.',
  rebate_requires_installment_account:
    'A rebate can only be given on an installment plan. This invoice has no linked installment account.',
  penalty_exceeds_assessed:
    "The penalty is more than what's actually assessed — 5% of the part of a due being paid, and only for a due at least 15 days past its due date.",
}

function paymentErrorMessage(res: { message?: string; error?: string }): string {
  const raw = res.message || res.error
  if (!raw) return 'Failed to collect payment'
  return PAYMENT_ERROR_MESSAGES[raw] ?? raw
}

// A due's lateness/rebate/penalty preview, live against whatever payment
// date is actually about to submit — NEVER a snapshot taken when the panel
// opened. Using a stale date here is exactly the bug that let a cashier see
// (and check) a penalty/rebate the backend then rejected: the cashier
// free-edits PaymentPanel's own Payment date field independently of
// whatever date the panel opened with, and the backend recomputes this
// exact same math against the real submitted paymentDate — so the preview
// must track that same live field, not the date the panel was opened with.
function dueSuggestions(
  line: InstallmentScheduleLineWithInvoice,
  ppd: number | null,
  paymentDateIso: string
): { isLate: boolean; suggestedRebate: number | null; penaltyEligible: boolean } {
  // Raw date comparison, not dueStatus() — a PARTIAL due counts as late too,
  // same as a SENT one. Used for the Late badge and to default the rebate
  // checkbox unchecked below — a late due can still have its rebate granted
  // (developer decision, reversing the original forfeit-on-late rule), it
  // just isn't pre-checked the way an on-time due's is. Mirrors
  // ar-invoices.service.ts's applySingleInvoicePayment() cap logic exactly,
  // so this preview can never promise more than the backend will allow.
  const isLate = line.dueDate.slice(0, 10) < paymentDateIso
  // Late-payment penalty — applies once the due is at least 15 days past its
  // own due date (same day-count as applySingleInvoicePayment()'s own penalty
  // cap). HOW MUCH is not a property of the due: the penalty follows the
  // money, so it is 5% of whatever part of the due the payment settles (see
  // penaltyOn / allocateBulkPayment).
  const daysLate = Math.floor(
    (new Date(paymentDateIso).getTime() - new Date(line.dueDate.slice(0, 10)).getTime()) /
      (24 * 60 * 60 * 1000)
  )
  return {
    isLate,
    suggestedRebate: ppd,
    penaltyEligible: daysLate >= PENALTY_GRACE_DAYS,
  }
}

// Late-payment penalty rate and grace period — mirrors penalty-waiver.util.ts
// in the backend, which enforces them.
const PENALTY_RATE = 0.05
const PENALTY_GRACE_DAYS = 15

/** The penalty on `applied` pesos settled against a late due. A due paid in two
 * halves carries 5% on each half — 5% of the whole once both are in. */
function penaltyOn(applied: number): number {
  return Math.round(Math.max(applied, 0) * PENALTY_RATE * 100) / 100
}

// Splits a bulk payment's typed Total across the selected dues (given in due
// order): settle one due in full — its amount capped at what it still needs
// after its own (checkbox-resolved) rebate — before any leftover flows to
// the next due. Whatever's left once every due is fully covered lands on the
// last due as an overpayment (matching the backend's own per-line
// overpayment check), rather than being silently dropped. Rebate is no longer
// sliced from a combined pool here — each due's amount is already known
// directly from its own checkbox state, resolved by the caller. The penalty is
// derived HERE, from what lands on each due: 5% of the part of a late due this
// payment settles (amount + its rebate + any tax withheld, never more than
// what the due still needs), so a due paid in two payments is charged on each.
function allocateBulkPayment(
  lines: {
    line: InstallmentScheduleLineWithInvoice
    rebateAmount: number
    /** The due is 15+ days late and its penalty checkbox is on. */
    penaltyApplies: boolean
  }[],
  totalAmount: number,
  withholding = 0
): {
  line: InstallmentScheduleLineWithInvoice
  amount: number
  rebateAmount: number
  penaltyAmount: number
}[] {
  let remainingAmount = Math.max(totalAmount, 0)
  return lines.map(({ line, rebateAmount, penaltyApplies }, i) => {
    const outstanding = dueOutstanding(line)
    const neededAmount = Math.max(Math.round((outstanding - rebateAmount) * 100) / 100, 0)
    const isLast = i === lines.length - 1
    const amount =
      Math.round((isLast ? remainingAmount : Math.min(remainingAmount, neededAmount)) * 100) / 100
    remainingAmount = Math.max(Math.round((remainingAmount - amount) * 100) / 100, 0)
    const settled = Math.min(outstanding, amount + rebateAmount + withholding)
    return { line, rebateAmount, penaltyAmount: penaltyApplies ? penaltyOn(settled) : 0, amount }
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
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
              <span className="truncate">{customer.name}</span>
              {customer.isEmployee && (
                <span className="shrink-0 rounded-full bg-prominent-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                  Employee
                </span>
              )}
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
          {!!customer.applianceOutstanding && (
            <span className="block text-[12px] text-prominent-purple-700">
              {fmtMoney(customer.applianceOutstanding)} appliance loan
            </span>
          )}
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
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  // Installment plans folded to just their header (an accordion), so a
  // customer with several plans can see the others without scrolling past one's
  // whole schedule. Only the view: a due checked inside a folded plan stays
  // checked and still counts toward the payment.
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Set<string>>(new Set())
  const [pendingScheduleId, setPendingScheduleId] = useState<string | null>(null)
  // Scenario 54 — lets a collector preview due statuses/rebate eligibility as
  // of a hypothetical date instead of real today. Local component state only:
  // never persisted (no localStorage/URL param), so it's gone the moment this
  // screen unmounts — no other screen or backend "now" is ever affected.
  const [overrideDateIso, setOverrideDateIso] = useState<string | null>(null)

  const debouncedQuery = useDebounced(query, 300)
  const customersQuery = useCollectionsCustomers(branchId || undefined, debouncedQuery || undefined)
  const schedulesQuery = useCustomerInstallmentSchedules(customer?.id)

  const customers = customersQuery.data?.success ? (customersQuery.data.data ?? []) : []
  const schedules = schedulesQuery.data?.success ? (schedulesQuery.data.data ?? []) : []
  // A plan whose every due is paid has nothing left to collect, so Collections
  // does not list it (its history lives on the ledger and the AR invoice). A
  // plan with some dues still open keeps its paid ones in view as progress.
  const openSchedules = schedules.filter((s) => s.lines.some((l) => !l.settledAt))
  // Scenario 54 — the simulated "now" this screen reads dues against: the
  // override while one's active, real today otherwise. PaymentPanel seeds its
  // Payment date from this, so Status/Rebate/Penalty are assessed — and the
  // collection recorded — as of the simulated date, the only way a late
  // penalty can really be charged against a due that isn't late yet. With no
  // override this is real today and the Payment date field is capped there.
  const effectivePaymentDateIso = overrideDateIso ?? todayIso()
  // Only `ppd` is carried here — NOT a precomputed suggestedRebate/
  // penaltyEligible. PaymentPanel's own Payment date field is freely
  // editable independently of effectivePaymentDateIso, and the backend
  // recomputes rebate/penalty caps against whatever date actually submits —
  // so PaymentPanel derives its own live preview from dueSuggestions() +
  // its current form.paymentDate, never a value baked in at selection time.
  const selectedPayableLines = schedules.flatMap((s) =>
    s.lines
      .filter((l) => selectedLineIds.has(l.id))
      .map((l) => ({
        line: l,
        ppd: s.installmentAccount?.ppd != null ? Number(s.installmentAccount.ppd) : null,
      }))
  )

  function selectCustomer(next: PosCustomer | null) {
    setCustomer(next)
    setSelectedLineIds(new Set())
    setCollapsedPlanIds(new Set())
  }

  function togglePlan(planId: string) {
    setCollapsedPlanIds((prev) => {
      const next = new Set(prev)
      if (next.has(planId)) next.delete(planId)
      else next.add(planId)
      return next
    })
  }

  // Deep link from an installment plan's due row (Customer360 / Installment
  // Account Detail) — arrives as ?customerId&customerName&scheduleId. It
  // pre-selects the customer and, once schedules load, checks that
  // schedule's next open due and opens the pay modal on it, which is the
  // "Pay Selected" equivalent of landing straight on that due. The query
  // string is cleared right after so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (deepLinkHandled.current) return
    const dlCustomerId = searchParams.get('customerId')
    if (!dlCustomerId) return
    deepLinkHandled.current = true
    selectCustomer({ id: dlCustomerId, name: searchParams.get('customerName') || 'Customer' })
    setPendingScheduleId(searchParams.get('scheduleId'))
    router.replace('/pos/collections')
  }, [searchParams, router])

  useEffect(() => {
    if (!pendingScheduleId || schedulesQuery.isLoading) return
    const match = schedules.find((s) => s.id === pendingScheduleId)
    const nextDue = match?.lines.filter(isEligibleForBulkPay)[0]
    if (match && nextDue) {
      setSelectedLineIds(toggleLineSelection(match.lines, nextDue, new Set()))
    }
    setPendingScheduleId(null)
  }, [pendingScheduleId, schedules, schedulesQuery.isLoading])

  return (
    <div className="min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="w-full space-y-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-prominent-purple-900">Collections</h1>
        </div>

        {/* Scenario 54 — simulate a hypothetical "today" across this screen
            only. Local state, never persisted: switching screens or
            reloading always comes back to real today. */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
            <CalendarClock className="h-4 w-4 text-zinc-400" />
            Override current date
          </label>
          <input
            type="date"
            value={overrideDateIso ?? todayIso()}
            onChange={(e) =>
              setOverrideDateIso(e.target.value === todayIso() ? null : e.target.value)
            }
            className={`${fieldClass} w-auto`}
          />
          {overrideDateIso && (
            <button
              type="button"
              onClick={() => setOverrideDateIso(null)}
              className="text-sm font-medium text-prominent-purple-600 hover:underline"
            >
              Reset to today
            </button>
          )}
        </div>
        {overrideDateIso && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white">
            <CalendarClock className="h-4 w-4 shrink-0" />
            Viewing this screen as of {fmtDate(overrideDateIso)}, not today — due statuses and
            rebate eligibility below reflect this simulated date, not real collections.
          </div>
        )}

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
              <div className="flex items-center gap-4">
                {/* Opens in a new tab — a cashier mid-collection may have
                    dues checked and a payment in progress on this screen;
                    navigating away in place would lose that selection. */}
                <Link
                  href={`/pos/customers/${customer.id}/ledger`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-prominent-purple-700 hover:underline"
                >
                  View ledger
                </Link>
                <button
                  onClick={() => selectCustomer(null)}
                  className="text-[13px] font-medium text-prominent-purple-700 hover:underline"
                >
                  Change customer
                </button>
              </div>
            </div>

            {/* Left: due list. Right: live payment panel driven by whatever's
                checked on the left — no modal, no "Pay Selected" trigger
                needed, the panel is always here (client feedback). */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_2fr]">
              <div className="space-y-4">
                {schedulesQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading installment plans…
                  </div>
                )}
                {!schedulesQuery.isLoading && openSchedules.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 shadow-sm"
                    data-testid="no-open-plans"
                  >
                    <Banknote className="mb-3 h-10 w-10 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">
                      {schedules.length === 0
                        ? 'No installment plans for this customer'
                        : 'Every installment plan is fully paid'}
                    </p>
                    {schedules.length > 0 && (
                      <p className="mt-1 text-xs text-zinc-400">Nothing left to collect.</p>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {openSchedules.map((s) => (
                    <div
                      key={s.id}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => togglePlan(s.id)}
                        aria-expanded={!collapsedPlanIds.has(s.id)}
                        data-testid={`plan-toggle-${s.id}`}
                        className={`flex w-full flex-wrap items-center justify-between gap-2 border-zinc-100 bg-zinc-50 px-5 py-2.5 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-100 ${
                          collapsedPlanIds.has(s.id) ? '' : 'border-b'
                        }`}
                      >
                        {/* The Sales Invoice / Delivery Receipt No. the customer holds —
                            the internal POS-<epoch> number means nothing outside the
                            system. Only a sale booked before it was required falls
                            back to it. */}
                        <span className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                              collapsedPlanIds.has(s.id) ? '-rotate-90' : ''
                            }`}
                          />
                          <span className="font-mono">
                            {s.posTransaction?.salesInvoiceNumber?.trim() ||
                              s.posTransaction?.transactionNumber ||
                              s.id}
                          </span>
                        </span>
                        <span>
                          {/* Folded: what is inside, since the dues are not. */}
                          {collapsedPlanIds.has(s.id) && (
                            <span className="mr-2 text-zinc-500" data-testid="plan-summary">
                              {s.lines.filter((l) => l.settledAt).length} of {s.lines.length} paid
                              {s.lines.some((l) => selectedLineIds.has(l.id)) &&
                                ` · ${s.lines.filter((l) => selectedLineIds.has(l.id)).length} selected`}
                              {' · '}
                            </span>
                          )}
                          {s.lines[0]?.arInvoice.isEmployeeApplianceLoan && (
                            <span className="mr-2 rounded-full bg-prominent-purple-50 px-2 py-0.5 text-[11px] font-medium text-prominent-purple-700">
                              Appliance loan · paid by payroll
                            </span>
                          )}
                          {s.termMonths} mo · Monthly {fmtMoney(s.monthlyInstallment)}
                        </span>
                      </button>
                      {!collapsedPlanIds.has(s.id) &&
                        (() => {
                          // Dues are settled in order — the earliest unsettled
                          // line is the only one collectible. Backed by a matching
                          // hard block server-side (ar-invoices.service.ts applies
                          // every collection oldest-due-first), so this is UI
                          // convenience, not the only guard.
                          const nextDueLineNumber = s.lines.find((l) =>
                            isEligibleForBulkPay(l)
                          )?.lineNumber
                          return (
                            <ul className="divide-y divide-zinc-100">
                              {s.lines.map((line) => {
                                // Fully paid dues can no longer be collected against
                                // at all through this screen — no more overpayment
                                // entry via a stray click here. A genuine correction
                                // (e.g. reversing a bad payment) goes through
                                // Accounting → AR Invoices instead.
                                const isFullyPaid = !!line.settledAt
                                const isNextDue = line.lineNumber === nextDueLineNumber
                                const isEligible = isEligibleForBulkPay(line)
                                const isSelected = selectedLineIds.has(line.id)
                                return (
                                  <li
                                    key={line.id}
                                    className="flex items-center justify-between gap-3 px-5 py-3"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      {isEligible && (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() =>
                                            setSelectedLineIds((prev) =>
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
                                          {fmtDate(line.dueDate)}
                                        </div>
                                        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                                          <StatusBadge
                                            status={dueStatus(line, overrideDateIso ?? undefined)}
                                          />
                                          <span>
                                            {fmtMoney(Number(line.paidAmount))} of{' '}
                                            {fmtMoney(Number(line.amount))} paid
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

              <div className="lg:sticky lg:top-6">
                <PaymentPanel
                  // Remounts fresh whenever the checked dues change — a
                  // stale error/overpayment result or a form field typed for
                  // the previous selection should never carry over, same as
                  // the old "Pay Selected" opened a brand-new modal each
                  // time (see the component's own doc comment).
                  key={Array.from(selectedLineIds).sort().join(',')}
                  lines={selectedPayableLines}
                  payrollOnly={
                    openSchedules.length > 0 &&
                    openSchedules.every((sc) => sc.lines[0]?.arInvoice.isEmployeeApplianceLoan)
                  }
                  customerName={customer?.name}
                  defaultBranchId={branchId || undefined}
                  initialPaymentDateIso={effectivePaymentDateIso}
                  onClearSelection={() => setSelectedLineIds(new Set())}
                  onCollected={async () => {
                    await Promise.all([schedulesQuery.refetch(), customersQuery.refetch()])
                    setSelectedLineIds(new Set())
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Live payment panel, inline beside the due list — not a modal (client
 * feedback). Reflects whichever dues are currently checked on the left, one
 * due or several at once, same shell/field set either way, both defaulting to
 * paying every checked due off in full. Amount/Total is always freely typed;
 * Rebate and Penalty are checkbox-driven per due instead — rebate defaults
 * checked (still on time), penalty defaults checked once a due qualifies
 * (15+ days late), and penalty has no amount override at all — it's
 * auto-calculated only, never typed by a cashier. Both — and whether a due
 * even counts as late — are derived LIVE from the Payment date field
 * (liveLines/dueSuggestions), never the date this panel happened to open
 * with, since a cashier can freely back/post-date that field and the
 * backend recomputes the exact same caps against whatever date actually
 * submits. For a batch,
 * allocateBulkPayment() splits whatever's typed into Amount across the
 * checked dues in due order — settling one in full before any leftover flows
 * to the next, same order the defaults already imply — so a custom partial
 * amount on an earlier due still just means checking only that one. The CR
 * number is required in both modes — every collection cuts a collection
 * receipt, and a payment recorded without one can't be reconciled against
 * the booklet.
 *
 * The parent remounts this component (via a `key` tied to the selected line
 * IDs) whenever the selection changes, so its own local state — the typed
 * form fields, any error, an overpayment result — always starts fresh for
 * the new selection rather than needing to be manually reconciled against it.
 */
function PaymentPanel({
  lines,
  payrollOnly,
  customerName,
  defaultBranchId,
  initialPaymentDateIso,
  onClearSelection,
  onCollected,
}: {
  /** Every plan on screen is an Employee Appliance Loan — nothing here can
   * be collected, so the empty state says why instead of asking for a check. */
  payrollOnly?: boolean
  lines: {
    line: InstallmentScheduleLineWithInvoice
    /** The linked InstallmentAccount's PPD, or null with no linked account —
     * raw ingredient only. Rebate/penalty are NOT precomputed here; they're
     * derived live inside this panel via dueSuggestions(), against whatever
     * Payment date is currently in the form (see that field below), so a
     * cashier who back/post-dates a collection always sees exactly what the
     * backend will actually allow for that date — never a stale snapshot of
     * the date this panel happened to open with. */
    ppd: number | null
  }[]
  customerName?: string
  /** Falls back to the Collections list's own branch filter, if the cashier
   * had one set — used only until the session's own branch resolves below. */
  defaultBranchId?: string
  /** Scenario 54 — the screen's simulated "now": its active date override, or
   * real today with none active. Seeds the Payment date, which drives the
   * Status/Rebate/Penalty figures and the date the collection is recorded on.
   * Without an override the field is capped at real today. */
  initialPaymentDateIso: string
  onClearSelection: () => void
  /** Async: resolves only once the parent's post-payment refetch has
   * actually landed, so the caller can keep the submit button's
   * spinner/disabled state up until the parent clears the selection (which
   * remounts this panel fresh) — see the component doc comment above. */
  onCollected: () => Promise<void>
}) {
  // The payments the collection was taken with — one, or several methods
  // (part cash, part GCash, part card). Each Amount received starts blank:
  // the cashier types what was actually handed over, never assumed. Rebate /
  // Penalty are not free-typed at all (see rebateChecked/penaltyChecked
  // below) — both are checkbox-driven per due.
  const [payments, setPayments] = useState<CollectionPaymentRow[]>(() => [
    newCollectionPaymentRow(),
  ])
  // Set when Collect payment is pressed with something missing, so the list
  // (and the red fields) only appear then, and shrink live as each gap fills.
  const [showIssues, setShowIssues] = useState(false)
  const [form, setForm] = useState({
    withholdingAmount: '0',
    // The date override, when one is active — so the penalty/rebate the
    // backend assesses for this date are the ones previewed below.
    paymentDate: initialPaymentDateIso.slice(0, 10),
    // The collection's ONE CR number — every payment's receipt carries it.
    reference: '',
    notes: '',
    branchId: '',
  })

  // Live per-due preview, recomputed on every render against form.paymentDate
  // — NOT the date this panel opened with. A cashier can freely retype the
  // Payment date field below (backdating/postdating a collection); when they
  // do, whether a due still counts as late, its rebate eligibility, and its
  // penalty all have to move with that field, since the backend recomputes
  // this exact same math against whatever paymentDate actually submits.
  const liveLines = lines.map(({ line, ppd }) => ({
    line,
    ppd,
    ...dueSuggestions(line, ppd, form.paymentDate),
  }))

  // Distinguishes the single-due UI (an "Outstanding" reference row) from
  // the batch UI (an itemized dues list) — both share the same editable
  // Amount/Total + Rebate fields below.
  const single = liveLines.length === 1 ? liveLines[0] : null
  const outstanding = single ? dueOutstanding(single.line) : 0
  // Defense-in-depth: the list view already hides the checkbox entirely for
  // a fully-paid due (see isEligibleForBulkPay), so this should be
  // unreachable in the normal flow — but if it is reached (stale list, race
  // with another cashier), hard-block submit here too instead of only
  // allowing it through as an overpayment.
  const isFullyPaid = !!single?.line.settledAt

  // Sums across every selected due — used for the rebate cap and for the
  // Total/Rebate fields' initial values (paying each due off in full is the
  // sensible starting point; the cashier can edit either field from there).
  const outstandingSum = liveLines.reduce((sum, { line }) => sum + dueOutstanding(line), 0)
  const rebateCapSum = liveLines.reduce(
    (sum, { suggestedRebate }) => sum + (suggestedRebate ?? 0),
    0
  )
  // What the penalty would come to if every selected due were paid in full —
  // the at-a-glance figure. What a given payment is actually charged follows
  // the amount typed (see bulkAllocated), since the penalty is 5% of the part
  // of each late due being paid.
  const penaltyCapSum = liveLines.reduce(
    (sum, { line, penaltyEligible }) =>
      sum + (penaltyEligible ? penaltyOn(dueOutstanding(line)) : 0),
    0
  )
  const outstandingTotal = single ? outstanding : outstandingSum

  // Rebate defaults checked whenever a due is on-time and has a suggested
  // rebate — it's already been earned, so applying it is the default, not
  // something the cashier has to opt into. A late due can still have its
  // rebate granted (see dueSuggestions — no longer auto-forfeited), but
  // defaults unchecked since it's a cashier exception, not the earned norm.
  // Penalty defaults checked whenever a due qualifies (15+ days late) —
  // developer-confirmed (this feature is "real" now, not simulate-only).
  // Both keyed by line.id so a batch's dues can be applied/waived
  // independently of each other. Seeded once at mount, against the Payment
  // date field's own starting value — this panel remounts fresh whenever
  // the selection changes (see the component doc comment above), so this
  // never goes stale against a different set of dues. If the cashier later
  // edits the Payment date, a due's checkbox stays wherever they left it;
  // rebateAmountFor below (and bulkAllocated, for the penalty) always clamp to the LIVE cap
  // regardless, so a checked-but-no-longer-qualifying due safely
  // contributes ₱0 rather than ever submitting more than the backend will
  // actually allow.
  const [rebateChecked, setRebateChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      lines.map(({ line, ppd }) => {
        const s = dueSuggestions(line, ppd, initialPaymentDateIso)
        return [line.id, !s.isLate && (s.suggestedRebate ?? 0) > 0]
      })
    )
  )
  // Penalty has no amount override at all — auto-calculated only, per the
  // developer's explicit instruction ("should not be inputted by a
  // personel"). Checked = the 5% applies to whatever part of the due this
  // payment settles; unchecked = none.
  const [penaltyChecked, setPenaltyChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      lines.map(({ line, ppd }) => [
        line.id,
        dueSuggestions(line, ppd, initialPaymentDateIso).penaltyEligible,
      ])
    )
  )

  function rebateAmountFor(lineId: string, suggestedRebate: number | null): number {
    return rebateChecked[lineId] ? (suggestedRebate ?? 0) : 0
  }
  // Resolved together (id + name) before ever touching form.branchId, so the
  // combobox's one-shot initialLabel is never stale — see BranchSearchCombobox's
  // key usage below for why this is a separate piece of state from form.branchId.
  const [branchDefault, setBranchDefault] = useState<{ id: string; name: string } | null>(null)
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
  //
  // Scenario 60 — a caravan defaults to the branch hosting it, the one the
  // combobox offers and the one the receipt is filed against, so the field
  // never shows a caravan the backend would then fold away.
  useEffect(() => {
    let cancelled = false
    Promise.all([getSessionIfAvailable(), getBranches()]).then(([session, branchesRes]) => {
      if (cancelled) return
      const branches = branchesRes.data ?? []
      const targetId = session?.branchId || defaultBranchId
      const target = branches.find((b) => b.id === targetId)
      const match = target?.isTemporary
        ? branches.find((b) => b.id === target.hostBranchId)
        : target
      if (!match) return
      setBranchDefault({ id: match.id, name: match.name })
      setForm((f) => (f.branchId ? f : { ...f, branchId: match.id }))
    })
    return () => {
      cancelled = true
    }
  }, [defaultBranchId])

  const paymentMethods = useCollectionsPaymentMethods(form.branchId)
  // Each payment falls through to Cash (the default this form always had)
  // until the cashier picks something else, or the branch's methods don't
  // include what they'd picked — derived at render rather than synced into
  // state via an effect.
  const tiles = availableTiles(paymentMethods)
  const resolvedPayments = payments.map((row) =>
    resolveCollectionPayment(row, tiles, paymentMethods)
  )
  const several = payments.length > 1
  // What was typed across every payment — what the collection received.
  const typedAmount = Math.round(resolvedPayments.reduce((sum, r) => sum + r.amount, 0) * 100) / 100
  const anyAmountTyped = payments.some((p) => p.amount.trim() !== '')

  function updatePayment(index: number, patch: Partial<CollectionPaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  // Rebate resolved per due from the checkbox state above, against the LIVE
  // suggestion for form.paymentDate (liveLines, not the raw `lines` prop) —
  // this is the single source of truth for both the single-due and batch cases
  // (a single due is just a one-element `lines`). Already capped by
  // construction (rebateAmountFor clamps to the due's own live suggestedRebate),
  // and since the cap itself tracks form.paymentDate, it can never promise more
  // than the backend will allow for whatever date actually submits. The penalty
  // is NOT resolved here: it is 5% of the part of each late due the payment
  // settles, so it can only be worked out once the typed amount has been
  // allocated across the dues (bulkAllocated below).
  const resolvedLines = liveLines.map(({ line, suggestedRebate, penaltyEligible }) => ({
    line,
    rebateAmount: rebateAmountFor(line.id, suggestedRebate),
    penaltyApplies: penaltyEligible && (penaltyChecked[line.id] ?? false),
  }))
  const rebateTotal = resolvedLines.reduce((sum, r) => sum + r.rebateAmount, 0)
  // The penalty on paying every selected due in full — drives the "Total with
  // penalty" at-a-glance figure only.
  const fullPenaltyTotal = resolvedLines.reduce(
    (sum, r) => sum + (r.penaltyApplies ? penaltyOn(dueOutstanding(r.line)) : 0),
    0
  )

  // Penalty deliberately excluded — it never touches AR, it's extra cash on
  // top of what's actually owed, so it plays no part in "does this settle
  // the due" math.
  const totalApplied = typedAmount + (Number(form.withholdingAmount) || 0) + rebateTotal
  const wouldOverpay = totalApplied > outstandingTotal + 0.01
  // Without an override the field is capped at real today, so "not today"
  // there can only mean a prior day; an override can also push it forward.
  const isBackdated = form.paymentDate.slice(0, 10) < todayIso()
  // The override is simulating a future "today", so this collection would be
  // recorded for a date that hasn't happened. A receipt dated forward is
  // invisible to the daily collection report (it windows on
  // CollectionReceipt.paymentDate) — say so, rather than letting it surprise.
  const isForwardDated = form.paymentDate.slice(0, 10) > todayIso()
  // The Payment date field's ceiling: real today, unless an override is
  // simulating a later day.
  const maxPaymentDate =
    initialPaymentDateIso.slice(0, 10) > todayIso()
      ? initialPaymentDateIso.slice(0, 10)
      : todayIso()
  // Informational only, not blocking — the backend only rejects a repeat
  // same-date payment once the invoice is already fully paid (isFullyPaid,
  // handled separately above). A due that's still open can be topped up
  // again on a date that already has a payment, so this just tells the
  // cashier that's what's about to happen.
  const alreadyPaidOnChosenDate = single ? hasPaymentOnDate(single.line, form.paymentDate) : false
  // Live per-due split of whatever's currently typed into Total, plus each
  // due's own resolved rebate/penalty — drives both the dues-list preview
  // below and the actual bulk submit payload, so what the cashier sees is
  // exactly what gets recorded.
  //
  // Until an amount is typed the preview assumes paying every selected due off
  // in full (the sensible starting point), so the penalty column reads what a
  // full payment would be charged; the moment one is typed it follows that
  // amount. The submit payload only ever sees a typed amount (the field is
  // required), so what is shown is what is recorded.
  const typedWithholding = single ? Number(form.withholdingAmount) || 0 : 0
  const previewAmount = !anyAmountTyped
    ? Math.max(Math.round((outstandingSum - rebateTotal - typedWithholding) * 100) / 100, 0)
    : typedAmount
  const bulkAllocated = allocateBulkPayment(resolvedLines, previewAmount, typedWithholding)

  /**
   * Scenario 53 Part 5b — the open session whose drawer this cash lands in,
   * if any.
   *
   * Cash taken here physically lands in that cashier's drawer, so the session
   * has to be named on the collection or close() cannot count it: the drawer
   * count included the cash while expectedClosingCash did not, and an honest
   * count closed as an unexplainable overage. Null is a legitimate answer (a
   * field collection, or the counter open with no session), and the backend
   * treats it as "not counter cash".
   *
   * Resolved as the SIGNED-IN USER'S own open session first, not simply the
   * branch's first one: a branch running two terminals has two open sessions,
   * and naming the wrong one is worse than naming none — it shorts the real
   * drawer and overs the other cashier's, so two people chase one variance.
   * With no session of their own (an accounting clerk taking a counter
   * payment) a single open session at the branch is still unambiguous, while
   * several is a genuine "which drawer?" that only the cashier can answer, so
   * this leaves it unattributed rather than guessing.
   */
  const { data: me } = useMe()
  const { data: openSessions } = useSessions(
    form.branchId ? { branchId: form.branchId, status: 'open' } : { status: 'open' }
  )
  const openSessionList = openSessions?.success ? (openSessions.data ?? []) : []
  const ownOpenSession = me ? openSessionList.find((s) => s.cashierId === me.id) : undefined
  const openSessionId =
    ownOpenSession?.id ?? (openSessionList.length === 1 ? openSessionList[0].id : undefined)

  // What the collection is still missing. Collect payment is never switched
  // off for these — pressing it lists them (and marks the fields) and sends
  // nothing, so the cashier is told what, not left with a dead button.
  const issues = collectionIssues({
    rows: resolvedPayments.map((r, i) => ({
      amount: r.amount,
      method: r.method,
      bankReferenceNumber: payments[i].bankReferenceNumber,
    })),
    cr: form.reference,
  })
  const shownIssues = showIssues ? issues : []
  const invalidFieldsOf = (row: number): ReadonlySet<CollectionIssueField> =>
    new Set(shownIssues.filter((i) => i.row === row).map((i) => i.field))
  const crInvalid = shownIssues.some((i) => i.field === 'cr')

  // The first payment describes the collection as a single method always did;
  // several are sent as `tenders` on top of it.
  const firstPayment = resolvedPayments[0]
  const tendersPayload = several
    ? resolvedPayments.map((r, i) => ({
        method: r.method,
        amount: r.amount,
        paymentMethodConfigId: r.option?.configId,
        paymentMethodOptionId: r.optionId,
        bankReferenceNumber: payments[i].bankReferenceNumber || undefined,
      }))
    : undefined

  // The next payment opens on a method none uses yet, with what is still
  // unpaid of the dues already in it (nothing once they are covered).
  const dueTarget = Math.max(
    Math.round((outstandingTotal - rebateTotal - typedWithholding) * 100) / 100,
    0
  )
  function addAnotherPayment() {
    // Until the branch's methods have loaded only Check is on offer; leave the
    // method unchosen then, so it resolves to the usual default once they do,
    // rather than locking this payment in to Check.
    const tile =
      tiles.length > 1
        ? nextTender(
            tiles,
            resolvedPayments.map((r) => r.tile)
          )
        : ''
    const left = Math.max(Math.round((dueTarget - typedAmount) * 100) / 100, 0)
    const row = newCollectionPaymentRow(tile, left > 0 && typedAmount > 0 ? String(left) : '')
    setPayments((prev) => [...prev, row])
    // The new block opens under the last one — take the cashier to it.
    window.setTimeout(() => {
      document
        .querySelector(`[data-testid="collection-payment-${payments.length}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (issues.length > 0) {
      setShowIssues(true)
      return
    }
    setSubmitting(true)
    setError(null)

    if (single) {
      const res = await ARInvoices.recordPayment(single.line.arInvoice.id, {
        amount: typedAmount,
        paymentDate: form.paymentDate,
        withholdingAmount: Number(form.withholdingAmount || 0),
        rebateAmount: resolvedLines[0]?.rebateAmount ?? 0,
        penaltyAmount: bulkAllocated[0]?.penaltyAmount ?? 0,
        method: firstPayment.method,
        paymentMethodConfigId: firstPayment.option?.configId,
        paymentMethodOptionId: firstPayment.optionId,
        reference: form.reference || undefined,
        bankReferenceNumber: payments[0].bankReferenceNumber || undefined,
        tenders: tendersPayload,
        notes: form.notes || undefined,
        branchId: form.branchId || undefined,
        posSessionId: openSessionId,
      })
      if (!res.success) {
        setSubmitting(false)
        setError(paymentErrorMessage(res))
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
          penaltyAmount: p.penaltyAmount,
        })),
        paymentDate: form.paymentDate,
        method: firstPayment.method,
        paymentMethodConfigId: firstPayment.option?.configId,
        paymentMethodOptionId: firstPayment.optionId,
        reference: form.reference || undefined,
        bankReferenceNumber: payments[0].bankReferenceNumber || undefined,
        tenders: tendersPayload,
        notes: form.notes || undefined,
        branchId: form.branchId || undefined,
        posSessionId: openSessionId,
      })
      if (!res.success) {
        setSubmitting(false)
        setError(paymentErrorMessage(res))
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
    // refetch actually lands — the parent clearing the selection remounts
    // this panel fresh right after, so there's nothing to reset
    // setSubmitting(false) for on the success path.
    await onCollected()
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center shadow-sm">
        <Banknote className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">
          {payrollOnly ? 'Paid through payroll' : 'No dues selected'}
        </p>
        <p className="mt-1 max-w-55 text-xs text-zinc-400">
          {payrollOnly
            ? 'An employee appliance loan is deducted from payroll, so there is nothing to collect here.'
            : 'Check one or more dues on the left to start collecting a payment.'}
        </p>
      </div>
    )
  }

  if (overpaymentResult) {
    const { overpaidCount, overpaidAmount, wasClosedAccount } = overpaymentResult
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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
                what was owed by <span className="font-semibold">{fmtMoney(overpaidAmount)}</span>.
                {wasClosedAccount &&
                  ' This installment due was already fully paid before this payment.'}{' '}
                A manager can cancel this specific payment from Accounting → AR Invoices if needed.
              </>
            ) : (
              <>
                This batch was <span className="font-semibold">not rejected</span> — {overpaidCount}{' '}
                of the {lines.length} payments exceeded what was owed. A manager can cancel any
                specific payment from Accounting → AR Invoices if needed.
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
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
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
                ? `due ${fmtDate(single.line.dueDate)}`
                : `${lines.length} due${lines.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-700 hover:underline"
        >
          Clear selection
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
          {single && isFullyPaid && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This due is already fully paid — any additional amount would be an overpayment, and
              this screen no longer allows recording one. If a correction is needed (e.g. reversing
              a mistaken payment), use Accounting → AR Invoices.
            </div>
          )}
          {single && !isFullyPaid && alreadyPaidOnChosenDate && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A payment was already collected
              on this plan on {isToday(form.paymentDate) ? 'today' : fmtDate(form.paymentDate)}.
              This will be recorded as an additional payment toward the remaining balance.
            </div>
          )}
          {single && !isFullyPaid && !alreadyPaidOnChosenDate && isBackdated && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This payment will be recorded for {fmtDate(form.paymentDate)}, not today — make sure
              that&apos;s intentional (e.g. entering a collection from a prior day).
            </div>
          )}
          {isForwardDated && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              The date override is simulating {fmtDate(form.paymentDate)}, so this payment will be
              recorded for that date, not today, and its Status, Rebate and Penalty are assessed as
              of it. It will not appear on today&apos;s daily collection report.
            </div>
          )}

          {/* Reference only — the cashier may not end up giving the
              rebate at all, so this shows both outcomes per due up
              front rather than assuming it's applied. What actually
              gets collected/submitted is whatever's typed into
              Total/Rebate below (see bulkAllocated). Same table for a
              single selected due as for multiple — it just renders one row. */}
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Due</th>
                  <th className="px-3 py-2 text-right font-medium">Rebate</th>
                  <th className="px-3 py-2 text-right font-medium">Penalty</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {liveLines.map(({ line, isLate, suggestedRebate, penaltyEligible }, rowIndex) => {
                  const remaining = dueOutstanding(line)
                  const cap = suggestedRebate ?? 0
                  // isLate/suggestedRebate/penaltyEligible are all live
                  // against form.paymentDate (see liveLines above), so
                  // this badge and the Rebate/Penalty columns beside it
                  // can never disagree with each other or with what the
                  // backend will actually allow for that date.
                  //
                  // Live per-due checkbox state — not just the cap — so
                  // Net reflects exactly what's about to be applied, same
                  // as resolvedLines/bulkAllocated below.
                  const rowRebate = rebateAmountFor(line.id, suggestedRebate)
                  // 5% of the part of this due the typed amount settles.
                  const rowPenalty = bulkAllocated[rowIndex]?.penaltyAmount ?? 0
                  const net = Math.max(Math.round((remaining - rowRebate) * 100) / 100, 0)
                  return (
                    <tr key={line.id}>
                      <td className="px-3 py-2 text-zinc-700">
                        Payment {line.lineNumber} · due {fmtDate(line.dueDate)}
                      </td>
                      <td className="px-3 py-2">
                        {isLate ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Late
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                            On-time
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">{fmtMoney(remaining)}</td>
                      <td className="px-3 py-2 text-right">
                        {cap > 0 ? (
                          <label className="flex items-center justify-end gap-1.5 text-emerald-700">
                            <input
                              type="checkbox"
                              checked={rebateChecked[line.id] ?? false}
                              onChange={(e) =>
                                setRebateChecked((prev) => ({
                                  ...prev,
                                  [line.id]: e.target.checked,
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                            />
                            −{fmtMoney(rowRebate)}
                          </label>
                        ) : (
                          <span className="text-zinc-400">{fmtMoney(0)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {penaltyEligible ? (
                          <label className="flex items-center justify-end gap-1.5 text-red-700">
                            <input
                              type="checkbox"
                              checked={penaltyChecked[line.id] ?? false}
                              onChange={(e) =>
                                setPenaltyChecked((prev) => ({
                                  ...prev,
                                  [line.id]: e.target.checked,
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-red-400 text-red-600 focus:ring-red-500"
                            />
                            +{fmtMoney(rowPenalty)}
                          </label>
                        ) : (
                          <span className="text-zinc-400">{fmtMoney(0)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900">
                        {fmtMoney(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rebateCapSum > 0 && (
            <p className="text-[12px] text-zinc-400">
              Rebate is about {((rebateCapSum / outstandingSum) * 100).toFixed(1)}% of the amount
              due.
            </p>
          )}
          {penaltyCapSum > 0 && (
            <p className="flex items-center gap-1.5 text-[12px] text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Dues 15+ days late are charged 5% on the part being paid
              {penaltyCapSum > 0 ? ` — ${fmtMoney(penaltyCapSum)} if paid in full` : ''}.
            </p>
          )}
          {/* Always visible, single or multiple dues — one at-a-glance
              figure for what's about to be collected before typing Amount
              received. Net of whatever rebates are currently checked in the
              table above; becomes "Total with penalty" once any checked due
              adds one. */}
          <div
            className={`flex items-center justify-between rounded-lg px-4 py-2 ${
              fullPenaltyTotal > 0 ? 'bg-red-50' : 'bg-zinc-50'
            }`}
          >
            <span
              className={`text-[12px] ${fullPenaltyTotal > 0 ? 'text-red-700' : 'text-zinc-500'}`}
            >
              {fullPenaltyTotal > 0 ? 'Total with penalty' : 'Total'}
            </span>
            <span
              className={`text-[13px] font-semibold ${fullPenaltyTotal > 0 ? 'text-red-800' : 'text-zinc-900'}`}
            >
              {fmtMoney(outstandingSum - rebateTotal + fullPenaltyTotal)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Payment date <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="date"
                // Capped at real today — cash is recognized on the day it
                // was received, and a forward-dated receipt would be
                // invisible to the daily collection report (it windows on
                // CollectionReceipt.paymentDate). The one exception is an
                // active date override, which lifts the cap to the date it
                // is simulating so a late penalty can be exercised.
                max={maxPaymentDate}
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
              <BranchSearchCombobox
                key={branchDefault?.id ?? 'no-default'}
                value={form.branchId}
                onChange={(id) => setForm({ ...form, branchId: id })}
                initialLabel={branchDefault?.name}
                placeholder="Search branch…"
              />
            </div>
          </div>

          {/* Every payment is one block — its method, then the Amount received
              right under it — so a collection can be taken with one method or
              several (part cash, part GCash, part card). */}
          <div className="space-y-5" data-testid="collection-payments">
            {payments.map((row, i) => (
              <div
                key={row.key}
                className={i > 0 ? 'border-t border-dashed border-purple-200 pt-5' : ''}
              >
                <CollectionPaymentBlock
                  index={i}
                  row={row}
                  tiles={tiles}
                  resolved={resolvedPayments[i]}
                  numbered={several}
                  onRemove={
                    i > 0
                      ? () => setPayments((prev) => prev.filter((p) => p.key !== row.key))
                      : undefined
                  }
                  invalid={invalidFieldsOf(i)}
                  onChange={(patch) => updatePayment(i, patch)}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addAnotherPayment}
            data-testid="add-another-collection-payment"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-purple-300 py-3 text-sm text-zinc-700 transition-colors hover:border-purple-500 hover:bg-purple-50 hover:text-purple-600 active:scale-[0.98]"
          >
            <Plus size={14} /> Add another payment method
          </button>

          {several && (
            <div className="space-y-1.5 text-sm" data-testid="collection-payment-summary">
              <div className="flex justify-between text-zinc-700">
                <span>Paid so far</span>
                <span className="font-mono font-medium" data-testid="collection-paid-so-far">
                  {fmtMoney(typedAmount)}
                </span>
              </div>
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 font-bold ${
                  dueTarget - typedAmount > 0.009
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-700'
                }`}
              >
                <span>Remaining</span>
                <span className="font-mono" data-testid="collection-remaining">
                  {fmtMoney(Math.max(dueTarget - typedAmount, 0))}
                </span>
              </div>
            </div>
          )}

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
              CR number <span className="text-red-500">*</span>
            </label>
            <input
              required
              data-testid="collection-cr-number"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="CR number"
              className={
                crInvalid ? fieldClass.replace('border-zinc-200', 'border-red-400') : fieldClass
              }
            />
            <p className="mt-1 text-[12px] text-zinc-400">
              {several
                ? 'Required — one CR number for the whole collection; every payment’s receipt carries it.'
                : 'Required — the CR number on the collection receipt issued for this payment.'}
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

          {shownIssues.length > 0 && (
            <div
              role="alert"
              data-testid="collection-issues"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <p className="font-semibold">You&apos;re missing:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {shownIssues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4">
          <button
            type="submit"
            // Only what can't be acted on stays off. Everything else is
            // clickable so the cashier is told what is missing.
            disabled={submitting || isFullyPaid}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? 'Collecting…'
              : single
                ? 'Collect payment'
                : `Pay ${fmtMoney(typedAmount)}`}
          </button>
        </div>
      </form>
    </div>
  )
}
