'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  Banknote,
  Coins,
  ArrowUpCircle,
  AlertOctagon,
  Check,
  X as XIcon,
  BellRing,
  Phone,
  Mail,
  MapPin,
  MoreHorizontal,
  CalendarClock,
  BookOpen,
  Receipt,
  CalendarCheck2,
  UserRound,
  Package,
  Landmark,
  Tags,
  Scale,
} from 'lucide-react'
import { installmentAccountsApi, remindersApi } from '@/src/libs/api/crm'
import EarlyPayoffModal from '@/src/components/crm/EarlyPayoffModal'
import RecordPaymentModal from '@/src/components/crm/RecordPaymentModal'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import CompleteReminderModal from '@/src/components/crm/CompleteReminderModal'
import { REMINDERS_ENABLED } from '@/src/libs/features'
import type {
  InstallmentAccountDetail as DetailType,
  CategoryGraduationRequest,
  DamEscalationRequest,
  LegalEscalationStatus,
  Reminder,
  ReminderType,
} from '@/src/schema/crm/types'

const LEGAL_ESCALATION_LABELS: Record<LegalEscalationStatus, string> = {
  none: 'Not started',
  soa_prepared: 'SOA prepared',
  demand_letter_sent: 'Demand letter sent',
  small_claims_pack_ready: 'Small Claims pack ready',
  filed: 'Filed',
}

const REMINDER_TYPE_ICON: Record<ReminderType, React.ElementType> = {
  call: Phone,
  email: Mail,
  visit: MapPin,
  other: MoreHorizontal,
}

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 ring-blue-200',
  closed: 'bg-gray-100 text-gray-600 ring-gray-200',
  early_closed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  written_off: 'bg-red-50 text-red-700 ring-red-200',
}

// Scenario 32 item 5 — same status set/labels as Customer360's
// InstallmentStatusBadge, restyled to match this page's ring-inset badges.
const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  OVERDUE: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
}
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'To pay',
  PARTIAL: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}
// The app's shared card recipe (DashboardWidgetWrapper's CARD_SHADOW_RESTING):
// a soft layered shadow that reads as depth without going heavy.
const CARD =
  'rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(29,15,56,0.03),0_8px_24px_-8px_rgba(29,15,56,0.08)]'

// A secondary action in the account header.
const ACTION_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50'

const INVOICE_STATUS_DOTS: Record<string, string> = {
  DRAFT: 'bg-gray-300',
  SENT: 'bg-blue-500',
  PARTIAL: 'bg-amber-500',
  PAID: 'bg-emerald-500',
  OVERDUE: 'bg-red-500',
  CANCELLED: 'bg-gray-300',
}

function Badge({ value, colors }: { value?: string | null; colors: Record<string, string> }) {
  if (!value) return <span className="text-gray-400">—</span>
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        colors[value] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {value.replace('_', ' ')}
    </span>
  )
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })
}

/** How the sale was paid for at the register: the method, with the bank or
 * wallet it went through, and each amount when it was split across several. */
function paymentMethodOf(
  tenders: { method: string; option: string | null; amount: number }[]
): string {
  if (tenders.length === 0) return '—'
  return tenders
    .map((t) => {
      const name = t.option ? `${t.method} (${t.option})` : t.method
      return tenders.length > 1 ? `${name} ${peso(t.amount)}` : name
    })
    .join(', ')
}

/** The cashier's CR number for each tender of the down payment — just the
 * number when there is one tender, the method beside each when it was split. */
function crNumbersOf(tenders: { method: string; referenceNumber: string | null }[]): string {
  const withCr = tenders.filter((t) => t.referenceNumber)
  if (withCr.length === 0) return 'none'
  if (tenders.length === 1) return withCr[0].referenceNumber as string
  return withCr.map((t) => `${t.method}: ${t.referenceNumber}`).join(', ')
}

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function InstallmentAccountDetail({
  id,
  canEdit,
  canEarlyPayoff,
  canRecordPayment,
  canApproveGraduation,
  canApproveDamEscalation,
  canManageLegalEscalation,
  canScheduleReminder,
  canViewCommission,
  currentUserId,
  tenantId,
}: {
  id: string
  canEdit: boolean
  canEarlyPayoff: boolean
  canRecordPayment: boolean
  canApproveGraduation: boolean
  canApproveDamEscalation: boolean
  canManageLegalEscalation: boolean
  canScheduleReminder: boolean
  /** What the selling agent earns on this sale — agent data, so shown only to
   * users who can read agents. */
  canViewCommission: boolean
  currentUserId: string
  tenantId: string
}) {
  const [account, setAccount] = useState<DetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payoffOpen, setPayoffOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [payoffQuote, setPayoffQuote] = useState<number | null>(null)
  // EarlyPayoffModal seeds its form state from `suggestedAmount` only on
  // mount (it stays mounted, just returns null while closed) — bumping this
  // key forces a fresh mount each time so the just-fetched quote actually
  // makes it into the pre-filled amount instead of the stale first value.
  const [payoffModalKey, setPayoffModalKey] = useState(0)

  async function openPayoffModal() {
    // Pre-fill with the real early-closure quote (ID/Terms x MosRun + LCP -
    // Total Paid) instead of the full remaining balance — falls back to the
    // balance only if the quote call fails, so the modal still opens.
    const res = await installmentAccountsApi.getEarlyPayoffQuote(id)
    setPayoffQuote(res.success ? (res.data?.payoffAmount ?? null) : null)
    setPayoffModalKey((k) => k + 1)
    setPayoffOpen(true)
  }

  const [graduationRequests, setGraduationRequests] = useState<CategoryGraduationRequest[]>([])
  const [requestingGraduation, setRequestingGraduation] = useState(false)
  const [graduationError, setGraduationError] = useState<string | null>(null)
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)

  const [damEscalationRequests, setDamEscalationRequests] = useState<DamEscalationRequest[]>([])
  const [requestingDamEscalation, setRequestingDamEscalation] = useState(false)
  const [damEscalationError, setDamEscalationError] = useState<string | null>(null)
  const [rejectingDamRequestId, setRejectingDamRequestId] = useState<string | null>(null)

  const [legalStatus, setLegalStatus] = useState<LegalEscalationStatus>('none')
  const [legalNotes, setLegalNotes] = useState('')
  const [savingLegalEscalation, setSavingLegalEscalation] = useState(false)
  const [legalEscalationError, setLegalEscalationError] = useState<string | null>(null)

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [scheduleReminderOpen, setScheduleReminderOpen] = useState(false)
  const [completingReminderId, setCompletingReminderId] = useState<string | null>(null)

  const loadReminders = useCallback(() => {
    if (!REMINDERS_ENABLED) return
    setRemindersLoading(true)
    remindersApi.list({ installmentAccountId: id, limit: 50 }).then((res) => {
      if (res.success && res.data) setReminders(res.data.data)
      setRemindersLoading(false)
    })
  }, [id])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  function reload() {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
    })
  }

  function reloadGraduationRequests() {
    installmentAccountsApi.listGraduationRequests(id).then((res) => {
      if (res.success && res.data) setGraduationRequests(res.data)
    })
  }

  function reloadDamEscalationRequests() {
    installmentAccountsApi.listDamEscalationRequests(id).then((res) => {
      if (res.success && res.data) setDamEscalationRequests(res.data)
    })
  }

  useEffect(() => {
    installmentAccountsApi.get(id).then((res) => {
      if (res.success && res.data) setAccount(res.data)
      else setError(res.error ?? 'Installment account not found')
      setLoading(false)
    })
    reloadGraduationRequests()
    reloadDamEscalationRequests()
  }, [id])

  // Keep the editable legal-escalation fields in sync with the account
  // whenever it (re)loads, so a save-then-reload reflects the persisted
  // value rather than stale local state.
  useEffect(() => {
    if (!account) return
    setLegalStatus(account.legalEscalationStatus ?? 'none')
    setLegalNotes(account.legalEscalationNotes ?? '')
  }, [account])

  const pendingGraduation = graduationRequests.find((r) => r.status === 'pending')
  const pendingDamEscalation = damEscalationRequests.find((r) => r.status === 'pending')

  async function handleRequestGraduation() {
    setGraduationError(null)
    setRequestingGraduation(true)
    const res = await installmentAccountsApi.requestGraduation(id, {})
    setRequestingGraduation(false)
    if (res.success) {
      reloadGraduationRequests()
    } else {
      setGraduationError(res.error ?? 'Failed to request graduation')
    }
  }

  async function handleApproveGraduation(requestId: string) {
    const res = await installmentAccountsApi.approveGraduation(id, requestId)
    if (res.success) {
      reload()
      reloadGraduationRequests()
    }
  }

  async function handleRejectGraduation(requestId: string, reason: string) {
    const res = await installmentAccountsApi.rejectGraduation(id, requestId, { reason })
    if (res.success) {
      setRejectingRequestId(null)
      reloadGraduationRequests()
    }
  }

  async function handleRequestDamEscalation() {
    setDamEscalationError(null)
    setRequestingDamEscalation(true)
    const res = await installmentAccountsApi.requestDamEscalation(id, {})
    setRequestingDamEscalation(false)
    if (res.success) {
      reloadDamEscalationRequests()
    } else {
      setDamEscalationError(res.error ?? 'Failed to request DAM escalation')
    }
  }

  async function handleApproveDamEscalation(requestId: string) {
    const res = await installmentAccountsApi.approveDamEscalation(id, requestId)
    if (res.success) {
      reload()
      reloadDamEscalationRequests()
    }
  }

  async function handleRejectDamEscalation(requestId: string, reason: string) {
    const res = await installmentAccountsApi.rejectDamEscalation(id, requestId, { reason })
    if (res.success) {
      setRejectingDamRequestId(null)
      reloadDamEscalationRequests()
    }
  }

  async function handleSaveLegalEscalation() {
    setLegalEscalationError(null)
    setSavingLegalEscalation(true)
    const res = await installmentAccountsApi.updateLegalEscalation(id, {
      status: legalStatus,
      notes: legalNotes || undefined,
    })
    setSavingLegalEscalation(false)
    if (res.success) {
      reload()
    } else {
      setLegalEscalationError(res.error ?? 'Failed to update legal escalation status')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">
        Loading installment account…
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/crm/installment-accounts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to installment accounts
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const canSettle = canEarlyPayoff && account.status === 'active'
  const canPay = canRecordPayment && account.status === 'active'
  // The first payment still to come — the one the billing list points at.
  const nextBillLine = account.billingHistory.find(
    (b) => b.status !== 'PAID' && b.status !== 'CANCELLED'
  )?.lineNumber

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/crm/installment-accounts"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to installment accounts
      </Link>

      {/* The account at a glance: who and what it is, what can be done to it,
          and the contract's headline figures — the page's anchor. */}
      <div className={`${CARD} overflow-hidden`}>
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-prominent-purple-900">
              {account.accountNumber}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-gray-700">{account.customer.name}</span>
              <Badge value={account.status} colors={STATUS_COLORS} />
              <Badge value={account.category} colors={CATEGORY_COLORS} />
              {account.inDam && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                  <AlertOctagon className="h-3 w-3" />
                  DAM
                </span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* The customer ledger narrowed to this plan — the account's own
                paper-form ledger (the same link the customer page uses). */}
            <Link
              href={`/crm/customers/${account.customerId}/ledger?transactionId=acct:${account.id}`}
              className={`${ACTION_BUTTON} flex-1 sm:flex-none`}
            >
              <BookOpen className="h-4 w-4" />
              View ledger
            </Link>
            {canPay && (
              <button
                onClick={() => setPaymentOpen(true)}
                className={`${ACTION_BUTTON} flex-1 sm:flex-none`}
              >
                <Coins className="h-4 w-4" />
                Record payment
              </button>
            )}
            {canSettle && (
              <button
                onClick={() => void openPayoffModal()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700 sm:flex-none"
              >
                <Banknote className="h-4 w-4" />
                Settle early
              </button>
            )}
            {canEdit && (
              <Link
                href={`/crm/installment-accounts/${id}/edit`}
                className={`${ACTION_BUTTON} flex-1 sm:flex-none`}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-prominent-purple-100 bg-prominent-purple-50 px-5 py-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-0 lg:divide-x lg:divide-prominent-purple-200">
          <Figure label="Listed cash price" value={peso(account.listedCashPrice)} />
          <Figure label="Down payment" value={peso(account.downPayment)} />
          <Figure label="Amount financed" value={peso(account.amountFinanced)} />
          <Figure
            label="Monthly installment"
            value={peso(account.monthlyInstallment)}
            note={`× ${account.termMonths} months`}
            accent
          />
          <Figure label="Total price" value={peso(account.totalPrice)} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Section title="Receipt details" icon={Receipt}>
            {account.saleReceipt ? (
              <dl className="grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-3">
                <Row label="Purchased on" value={fmtDateTime(account.saleReceipt.occurredAt)} />
                <Row label="Cashier" value={account.saleReceipt.cashier ?? '—'} />
                <Row label="Payment method" value={paymentMethodOf(account.saleReceipt.tenders)} />
                <Row label="SI / DR no." value={account.saleReceipt.documentNumber ?? 'none'} />
                <Row
                  label="CR no. (down payment)"
                  value={crNumbersOf(account.saleReceipt.tenders)}
                />
                <Row
                  label="Delivery fee CR no."
                  value={account.saleReceipt.deliveryFeeReferenceNumber ?? 'none'}
                />
              </dl>
            ) : (
              <p className="text-[13px] text-gray-500">
                Not available for hand-entered/imported accounts.
              </p>
            )}
          </Section>

          <Section title="Billing history" icon={CalendarCheck2}>
            {account.billingHistory.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-[13px] text-gray-600">
                  {account.billingHistory.filter((b) => b.status === 'PAID').length} of{' '}
                  {account.billingHistory.length} paid
                </p>
                <div className="flex gap-1">
                  {account.billingHistory.map((bill) => (
                    <span
                      key={bill.lineNumber}
                      className={`h-1.5 flex-1 rounded-full ${
                        bill.billed
                          ? (INVOICE_STATUS_DOTS[bill.status] ?? 'bg-gray-200')
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            {account.billingHistory.length > 0 ? (
              <ul className="divide-y divide-gray-100" data-testid="billing-history">
                {/* Keyed on the due, not the invoice: Scenario 47 gave a whole
                    installment sale one ARInvoice, so arInvoiceId now repeats
                    across every row of this list. lineNumber is unique within one
                    account's history. */}
                {account.billingHistory.map((bill) => {
                  const paid = Number(bill.amountPaid)
                  const remaining = Math.max(
                    Math.round((Number(bill.totalAmount) - paid) * 100) / 100,
                    0
                  )
                  const paidOn = bill.paidOn ? new Date(bill.paidOn).toLocaleDateString() : null
                  const isNext = bill.lineNumber === nextBillLine
                  return (
                    <li key={bill.lineNumber}>
                      <Link
                        href={`/accounting/ar-invoices/${bill.arInvoiceId}`}
                        className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 ${
                          isNext ? 'bg-prominent-purple-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            bill.billed
                              ? (INVOICE_STATUS_DOTS[bill.status] ?? 'bg-gray-300')
                              : 'bg-gray-300'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-prominent-purple-900">
                            Payment {bill.lineNumber} of {account.billingHistory.length}
                            {isNext && (
                              <span className="ml-2 rounded-full bg-prominent-purple-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                                Next
                              </span>
                            )}
                            <span className="font-normal text-gray-600">
                              {' · '}due {new Date(bill.dueDate).toLocaleDateString()}
                            </span>
                            {bill.status === 'PAID' && paidOn && (
                              <span className="font-normal text-emerald-600"> · paid {paidOn}</span>
                            )}
                          </span>
                          <span className="block font-mono text-[12px] text-gray-500">
                            {bill.invoiceNumber}
                          </span>
                          {bill.status === 'PARTIAL' && (
                            <span className="block text-[12px] text-amber-700">
                              {peso(paid)} paid{paidOn ? ` on ${paidOn}` : ''} · {peso(remaining)}{' '}
                              remaining
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-[13px] font-semibold text-prominent-purple-900">
                            {peso(bill.totalAmount)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                              bill.billed
                                ? (INVOICE_STATUS_COLORS[bill.status] ??
                                  'bg-gray-100 text-gray-600')
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {bill.billed
                              ? (INVOICE_STATUS_LABELS[bill.status] ?? bill.status)
                              : 'Not yet billed'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-gray-500">
                Not available for hand-entered/imported accounts.
              </p>
            )}
          </Section>

          {REMINDERS_ENABLED && (
            <Section
              title="Collections reminders"
              icon={BellRing}
              action={
                canScheduleReminder && (
                  <button
                    onClick={() => setScheduleReminderOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Schedule reminder
                  </button>
                )
              }
            >
              {remindersLoading && <p className="text-[13px] text-gray-500">Loading…</p>}

              {!remindersLoading && reminders.length === 0 && (
                <p className="text-[13px] text-gray-500">
                  No reminders logged for this account yet.
                </p>
              )}

              {!remindersLoading && reminders.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {reminders.map((r) => {
                    const Icon = REMINDER_TYPE_ICON[r.reminderType] ?? MoreHorizontal
                    const isPending = r.status === 'pending' || r.status === 'overdue'
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-2 first:pt-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                          <Icon className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-prominent-purple-900">
                            {r.note ?? r.reminderType}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-gray-500">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(r.dueAt).toLocaleString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {r.status === 'overdue' && (
                              <span className="ml-1 font-semibold text-red-600">Overdue</span>
                            )}
                          </p>
                        </div>
                        {isPending ? (
                          <button
                            onClick={() => setCompletingReminderId(r.id)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Complete
                          </button>
                        ) : (
                          <span className="shrink-0 text-[12px] font-medium text-gray-500">
                            Completed
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          )}

          {account.inDam && (
            <Section title="Legal escalation" icon={Scale} tone="danger">
              <p className="-mt-1 mb-3 text-[12px] text-gray-500">
                Checklist/status tracking only (Scenario 20) — no document generation.
              </p>

              {canManageLegalEscalation ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor="legal-escalation-status"
                      className="block text-[13px] font-medium text-gray-700"
                    >
                      Status
                    </label>
                    <select
                      id="legal-escalation-status"
                      value={legalStatus}
                      onChange={(e) => setLegalStatus(e.target.value as LegalEscalationStatus)}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      {Object.entries(LEGAL_ESCALATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="legal-escalation-notes"
                      className="block text-[13px] font-medium text-gray-700"
                    >
                      Notes
                    </label>
                    <input
                      id="legal-escalation-notes"
                      type="text"
                      value={legalNotes}
                      onChange={(e) => setLegalNotes(e.target.value)}
                      placeholder="e.g. SOA drafted, awaiting BM sign-off"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSaveLegalEscalation}
                    disabled={savingLegalEscalation}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
                  >
                    {savingLegalEscalation ? 'Saving…' : 'Update'}
                  </button>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Row
                    label="Status"
                    value={LEGAL_ESCALATION_LABELS[account.legalEscalationStatus ?? 'none']}
                  />
                  <Row label="Notes" value={account.legalEscalationNotes ?? '—'} />
                </dl>
              )}
              {legalEscalationError && (
                <p className="mt-2 text-[12px] text-red-600">{legalEscalationError}</p>
              )}
              {account.legalEscalationUpdatedAt && (
                <p className="mt-2 text-[12px] text-gray-500">
                  Last updated {new Date(account.legalEscalationUpdatedAt).toLocaleString()}
                </p>
              )}
            </Section>
          )}
        </div>

        <aside className="space-y-4 lg:col-span-2">
          <Section title="Customer & assignment" icon={UserRound}>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
              <Row label="Customer" value={account.customer.name} />
              <Row label="Phone" value={account.customer.phone ?? '—'} />
              <Row label="Email" value={account.customer.email ?? '—'} />
              <Row label="Branch" value={account.branch?.name ?? '—'} />
              <Row
                label="Collector"
                value={
                  account.collector
                    ? `${account.collector.stubNumber} — ${account.collector.name}`
                    : '—'
                }
              />
              <Row label="Salesperson" value={account.sellingAgent?.name ?? '—'} />
              {canViewCommission && (
                <Row
                  label="Sales commission"
                  value={
                    Number(account.salesCommission ?? 0) ? peso(account.salesCommission ?? 0) : '—'
                  }
                />
              )}
            </dl>
          </Section>

          <Section title="Unit" icon={Package}>
            {account.unitItems.length > 0 ? (
              <ul className="divide-y divide-gray-100 text-[13px]" data-testid="unit-items">
                {account.unitItems.map((unit) => (
                  <li key={unit.id} className="py-2.5 first:pt-0">
                    <div className="font-medium text-prominent-purple-900">
                      {unit.itemName
                        ? unit.brand
                          ? `${unit.itemName} (${unit.brand})`
                          : unit.itemName
                        : '—'}
                    </div>
                    <div className="mt-0.5 text-gray-500">
                      {unit.modelNumber && <div>Model: {unit.modelNumber}</div>}
                      {unit.serialNumber && (
                        <div className="font-mono text-[12px] text-prominent-purple-700">
                          SN: {unit.serialNumber}
                          {unit.secondarySerialNumber && ` / ${unit.secondarySerialNumber}`}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-gray-500">
                Not available for hand-entered/imported accounts.
              </p>
            )}
          </Section>

          <Section title="Financing details" icon={Landmark}>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
              <Row label="Scheme" value={account.priceUseType?.name ?? '—'} />
              <Row label="MI factor" value={String(account.miFactor)} />
              <Row label="PNV" value={peso(account.pnv)} />
              <Row label="Interest differential" value={peso(account.interestDifferential)} />
              <Row label="PPD" value={peso(account.ppd)} />
              <Row
                label="IC (Insurance charge)"
                value={account.insuranceCharge != null ? peso(account.insuranceCharge) : '—'}
              />
              <Row
                label="TMI (Total monthly income)"
                value={account.totalMonthlyIncome != null ? peso(account.totalMonthlyIncome) : '—'}
              />
            </dl>
          </Section>

          <Section title="Collection tags" icon={Tags}>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
              <Row label="Classification" value={account.classification ?? '—'} />
              <Row
                label="DAM entered"
                value={
                  account.damEnteredAt ? new Date(account.damEnteredAt).toLocaleDateString() : '—'
                }
              />
              <Row label="Months run" value={String(account.monthsRun)} />
              <Row label="Points" value={String(account.points)} />
            </dl>

            {account.category !== 'C' &&
              !pendingGraduation &&
              canEdit &&
              account.status === 'active' && (
                <div className="mt-4">
                  <button
                    onClick={handleRequestGraduation}
                    disabled={requestingGraduation}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    {requestingGraduation ? 'Requesting…' : 'Request graduation to Category C'}
                  </button>
                  {graduationError && (
                    <p className="mt-2 text-[12px] text-red-600">{graduationError}</p>
                  )}
                </div>
              )}

            {pendingGraduation && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[13px] font-medium text-amber-900">
                  Pending graduation to Category C
                </p>
                <p className="mt-0.5 text-[12px] text-amber-700">
                  Requires management approval before the category changes.
                </p>
                {canApproveGraduation && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleApproveGraduation(pendingGraduation.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingRequestId(pendingGraduation.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {!account.inDam && !pendingDamEscalation && canEdit && account.status === 'active' && (
              <div className="mt-3">
                <button
                  onClick={handleRequestDamEscalation}
                  disabled={requestingDamEscalation}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <AlertOctagon className="h-4 w-4" />
                  {requestingDamEscalation ? 'Requesting…' : 'Request DAM escalation'}
                </button>
                {damEscalationError && (
                  <p className="mt-2 text-[12px] text-red-600">{damEscalationError}</p>
                )}
              </div>
            )}

            {pendingDamEscalation && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-[13px] font-medium text-red-900">Pending DAM escalation</p>
                <p className="mt-0.5 text-[12px] text-red-700">
                  Requires management approval before the account moves to DAM.
                </p>
                {canApproveDamEscalation && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleApproveDamEscalation(pendingDamEscalation.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingDamRequestId(pendingDamEscalation.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </Section>
        </aside>
      </div>

      <ScheduleReminderModal
        open={scheduleReminderOpen}
        onClose={() => setScheduleReminderOpen(false)}
        onCreated={loadReminders}
        tenantId={tenantId}
        assignedTo={currentUserId}
        target={{ installmentAccountId: id, collectorId: account.collector?.id }}
      />

      <CompleteReminderModal
        open={completingReminderId !== null}
        onClose={() => setCompletingReminderId(null)}
        onCompleted={loadReminders}
        reminderId={completingReminderId}
      />

      <EarlyPayoffModal
        key={payoffModalKey}
        open={payoffOpen}
        onClose={() => setPayoffOpen(false)}
        onSettled={() => {
          reload()
          // Scenario 20 (NAMIDRe): an early payoff auto-closes any open
          // reminder on this account server-side — refresh the list so
          // that shows up without a manual page reload.
          loadReminders()
        }}
        accountId={id}
        suggestedAmount={payoffQuote ?? Number(account.currentBalance)}
      />

      <RecordPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onRecorded={() => {
          reload()
          // Scenario 20 (NAMIDRe): a recorded payment auto-closes any open
          // reminder on this account server-side — refresh the list so
          // that shows up without a manual page reload.
          loadReminders()
        }}
        accountId={id}
        suggestedAmount={Number(account.monthlyInstallment)}
        suggestedRebate={Number(account.ppd)}
        monthlyInstallment={Number(account.monthlyInstallment)}
        partialPaymentOnNextDue={Number(account.partialPaymentOnNextDue)}
      />

      {rejectingRequestId && (
        <RejectRequestModal
          title="Reject graduation request"
          onClose={() => setRejectingRequestId(null)}
          onReject={(reason) => handleRejectGraduation(rejectingRequestId, reason)}
        />
      )}

      {rejectingDamRequestId && (
        <RejectRequestModal
          title="Reject DAM escalation request"
          onClose={() => setRejectingDamRequestId(null)}
          onReject={(reason) => handleRejectDamEscalation(rejectingDamRequestId, reason)}
        />
      )}
    </div>
  )
}

function RejectRequestModal({
  title,
  onClose,
  onReject,
}: {
  title: string
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        <label
          htmlFor="reject-request-reason"
          className="block text-[13px] font-medium text-gray-700"
        >
          Reason
        </label>
        <textarea
          id="reject-request-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. arrears not yet cleared"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onReject(reason)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

/** A titled card — an icon, a heading, and its content. */
function Section({
  title,
  icon: Icon,
  action,
  tone,
  children,
}: {
  title: string
  icon: React.ElementType
  action?: React.ReactNode
  tone?: 'danger'
  children: React.ReactNode
}) {
  const danger = tone === 'danger'
  return (
    <section className={`${CARD} p-4 ${danger ? 'border-red-200' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              danger
                ? 'bg-red-50 text-red-600'
                : 'bg-prominent-purple-100 text-prominent-purple-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[14px] font-semibold text-prominent-purple-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One of the contract's headline figures. */
function Figure({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: string
  note?: string
  accent?: boolean
}) {
  return (
    <div className="lg:px-5 lg:first:pl-0">
      <p className="text-[12px] text-gray-600">{label}</p>
      <p
        className={`mt-0.5 text-xl font-semibold tracking-tight ${
          accent ? 'text-prominent-orange-800' : 'text-prominent-purple-900'
        }`}
      >
        {value}
      </p>
      {note && <p className="text-[12px] text-gray-600">{note}</p>}
    </div>
  )
}

/** A label over its value. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-gray-600">{label}</dt>
      <dd className="text-[13px] font-medium text-prominent-purple-900">{value}</dd>
    </div>
  )
}
