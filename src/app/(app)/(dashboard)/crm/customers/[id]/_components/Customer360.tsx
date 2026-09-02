'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BellPlus,
  ChevronRight,
  Download,
  GitMerge,
  Paperclip,
  Pencil,
  Receipt,
  Trash2,
  X,
} from 'lucide-react'
import { customersApi, installmentAccountsApi } from '@/src/libs/api/crm'
import { getCustomerHistoryWithPayments } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { TransactionDetail } from '@/src/app/(app)/(dashboard)/pos/_components/TransactionDetail'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { type SessionUser } from '@/src/libs/guards/permission'
import type { Customer, Lead, Reminder, InstallmentAccount } from '@/src/schema/crm/types'
import type { InstallmentSchedule, PosTransaction, CustomerHistoryItem } from '@/src/schema/pos'

// Same mapping TransactionsList.tsx uses for its own transaction rows —
// kept local rather than imported since that file doesn't export it.
const txTypeColor: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-purple-100 text-purple-700',
}
const txStatusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
}

function summarizeTransactionItems(tx: PosTransaction): string {
  const names = (tx.lines ?? []).map((l) => l.itemName)
  if (names.length === 0) return 'No items'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

type CustomerView = Customer & {
  leads: Lead[]
  reminders: Reminder[]
}

export default function Customer360({
  id,
  canEdit,
  canDelete,
  canScheduleReminder,
  currentUserId,
  tenantId,
}: {
  id: string
  canEdit: boolean
  canDelete: boolean
  canScheduleReminder: boolean
  currentUserId: string
  tenantId: string
}) {
  const router = useRouter()
  const [data, setData] = useState<CustomerView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [installmentSchedules, setInstallmentSchedules] = useState<InstallmentSchedule[]>([])
  const [installmentLoading, setInstallmentLoading] = useState(true)
  const [installmentError, setInstallmentError] = useState<string | null>(null)
  // Scenario 23 Gap 2 (developer-requested redesign, 2026-08-09) — each
  // schedule collapses to a summary row (product + term); the full
  // due-date/invoice-number/rebate breakdown lives behind a click, matching
  // the row-click-opens-detail-modal convention already used for POS
  // transactions (TransactionsList.tsx's TransactionDetail).
  const [scheduleDetailTarget, setScheduleDetailTarget] = useState<InstallmentSchedule | null>(null)

  const [installmentAccounts, setInstallmentAccounts] = useState<InstallmentAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // CRM-01: last 20 transactions (server-capped, GET /pos/transactions/customer/:customerId/history-with-payments)
  // — covers cash/full-payment sales too, unlike Installment Plans above,
  // merged with installment-due payments collected later via Collections.
  const [transactionHistory, setTransactionHistory] = useState<CustomerHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  // TransactionDetail (the same receipt modal POS's own pages use) requires
  // a real SessionUser — this page.tsx doesn't pass one down, so fetch it
  // client-side the same way pos/page.tsx does for its Recent Transactions.
  const [posSession, setPosSession] = useState<SessionUser | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<PosTransaction | null>(null)
  useEffect(() => {
    getSessionOrNull().then((s) => setPosSession(s))
  }, [])

  const upcomingPayables = useMemo(
    () => flattenUpcomingPayables(installmentSchedules),
    [installmentSchedules]
  )

  async function handleDelete() {
    if (!data) return
    if (!confirm(`Delete ${data.name}? This can't be undone from here.`)) return
    setDeleting(true)
    setDeleteError(null)
    const res = await customersApi.remove(id)
    setDeleting(false)
    if (res.success) {
      router.push('/crm/customers')
      router.refresh()
    } else {
      setDeleteError(res.error ?? 'Failed to delete customer')
    }
  }

  function reload() {
    customersApi.get360(id).then((res) => {
      if (res.success && res.data) setData(res.data)
    })
  }

  useEffect(() => {
    customersApi.get360(id).then((res) => {
      if (res.success && res.data) setData(res.data)
      else setError(res.error ?? 'Customer not found')
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    customersApi.getInstallmentSchedules(id).then((res) => {
      if (res.success && res.data) setInstallmentSchedules(res.data)
      else setInstallmentError(res.error ?? 'Failed to load installment plans')
      setInstallmentLoading(false)
    })
  }, [id])

  useEffect(() => {
    installmentAccountsApi.list({ customerId: id, limit: 50 }).then((res) => {
      if (res.success && res.data) setInstallmentAccounts(res.data.data)
      else setAccountsError(res.error ?? 'Failed to load CRM accounts')
      setAccountsLoading(false)
    })
  }, [id])

  useEffect(() => {
    getCustomerHistoryWithPayments(id).then((res) => {
      if (res.success && res.data) setTransactionHistory(res.data)
      else setHistoryError(res.error ?? 'Failed to load transaction history')
      setHistoryLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="px-6 py-8 text-gray-400">Loading customer…</div>
  }
  if (error || !data) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/crm/customers"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {data.mergedFrom && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[13px] text-sky-800">
          <GitMerge className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            You were redirected here — customer{' '}
            <span className="font-medium">
              {data.mergedFrom.name} ({data.mergedFrom.customerCode})
            </span>{' '}
            was merged into this record
            {data.mergedFrom.mergedAt
              ? ` on ${new Date(data.mergedFrom.mergedAt).toLocaleDateString()}`
              : ''}
            . That old profile is no longer active on its own.
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[12px] text-gray-500">{data.customerCode}</div>
          <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {data.companyName ? `${data.companyName} · ` : ''}
            {data.customerType === 'business' && data.businessCategory
              ? `${data.businessCategory === 'government' ? 'Government' : 'Private'} · `
              : ''}
            {data.customerType === 'employee' && data.employeeNumber
              ? `Employee ID: ${data.employeeNumber} · `
              : ''}
            {data.birthday ? `Birthday: ${new Date(data.birthday).toLocaleDateString()} · ` : ''}
            Source: {data.sourceChannel} · Status: {data.status}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Developer-requested (2026-08-09): previously the only path to
              this customer's AR invoices was buried inside an Installment
              Plan row's detail modal — which didn't exist at all for a
              charge-only customer with no installment plans. This is a
              direct, always-visible link regardless of purchase history.
              Repointed to the unified customer ledger (installment + charge
              + cash sales merged into one debit/credit table) instead of
              the raw AR invoice list — the AR invoices list itself stays
              reachable from Accounting → AR Invoices. */}
          <Link
            href={`/crm/customers/${id}/ledger`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Receipt className="h-4 w-4" />
            View Customer Ledger
          </Link>
          {canScheduleReminder && (
            <button
              onClick={() => setReminderOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <BellPlus className="h-4 w-4" />
              Schedule reminder
            </button>
          )}
          {canEdit && (
            <Link
              href={`/crm/customers/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}
        </div>
      </header>

      {upcomingPayables.length > 0 && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
            URGENCY_STRIP_CLASSES[
              payableUrgency(upcomingPayables[0].status, upcomingPayables[0].dueDate)
            ]
          }`}
        >
          <div className="text-[13px]">
            <span className="text-gray-500">Next payment due </span>
            <span className="font-semibold text-gray-900">
              {formatPeso(upcomingPayables[0].amountDue)}
            </span>
            <span className="text-gray-500">
              {' '}
              on {new Date(upcomingPayables[0].dueDate).toLocaleDateString()}
            </span>
          </div>
          <div className="text-[12px] text-gray-500">
            {upcomingPayables.length} upcoming ·{' '}
            {formatPeso(upcomingPayables.reduce((sum, p) => sum + p.amountDue, 0))} total
            <a
              href="#upcoming-payables"
              className="ml-2 font-medium text-prominent-orange-700 hover:underline"
            >
              View all ↓
            </a>
          </div>
        </div>
      )}

      <div className="mt-6">
        {/* Full width — the Address row wraps to several lines for a real
            PH address, and cramming that into a 1/3-width column read badly
            (developer-flagged, 2026-08-09). */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Contact</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Email" value={data.email ?? '—'} />
            <Row label="Phone" value={data.phone ?? '—'} />
            <Row label="Address" value={data.address ?? '—'} />
            <Row label="Tax exempt" value={data.isTaxExempt ? 'Yes' : 'No'} />
          </dl>
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Installment Plans</h2>
          {installmentLoading ? (
            <p className="py-4 text-center text-[13px] text-gray-400">Loading installment plans…</p>
          ) : installmentError ? (
            <p className="py-4 text-center text-[13px] text-red-600">{installmentError}</p>
          ) : installmentSchedules.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No installment plans for this customer.
            </p>
          ) : (
            <div className="space-y-2">
              {installmentSchedules.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScheduleDetailTarget(s)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 p-3 text-left text-[13px] transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="text-gray-800">{productLabel(s.posTransactionLines)}</p>
                    <p className="mt-0.5 text-[12px] text-gray-500">
                      {s.termMonths} months · Total {formatPeso(s.totalPayable)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.installmentAccount && (
                      <InstallmentPlanStatusBadge status={s.installmentAccount.status} />
                    )}
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Originating leads</h2>
          {data.leads.length === 0 && (
            <p className="py-4 text-center text-[13px] text-gray-400">
              This customer didn&apos;t come from a lead.
            </p>
          )}
          <ul className="divide-y divide-gray-100">
            {data.leads.map((l) => (
              <li key={l.id} className="py-2.5 text-[13px]">
                <Link
                  href={`/crm/leads/${l.id}`}
                  className="font-medium text-prominent-orange-700 hover:underline"
                >
                  {[l.firstName, l.lastName].filter(Boolean).join(' ')}
                </Link>
                <span className="ml-2 text-[12px] text-gray-500">{l.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Open reminders</h2>
          {data.reminders.length === 0 && (
            <p className="py-4 text-center text-[13px] text-gray-400">No open reminders.</p>
          )}
          <ul className="divide-y divide-gray-100">
            {data.reminders.map((r) => (
              <li key={r.id} className="py-2.5 text-[13px]">
                <div className="text-gray-800">{r.note ?? r.reminderType}</div>
                <div className="text-[12px] text-gray-500">
                  Due {new Date(r.dueAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4">
        <section id="upcoming-payables" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Upcoming Payables</h2>
          {installmentLoading ? (
            <p className="py-4 text-center text-[13px] text-gray-400">Loading upcoming payables…</p>
          ) : installmentError ? (
            <p className="py-4 text-center text-[13px] text-red-600">{installmentError}</p>
          ) : upcomingPayables.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No upcoming payables for this customer.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {upcomingPayables.slice(0, 10).map((p) => (
                  <li key={p.invoiceId} className="py-2.5 text-[13px]">
                    <button
                      type="button"
                      onClick={() => setScheduleDetailTarget(p.schedule)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg -mx-1 px-1 text-left hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        <span className="font-medium text-gray-800">
                          {productLabel(p.schedule.posTransactionLines)}
                        </span>
                        {' · '}
                        <span className="font-mono text-[11px] text-gray-400">
                          {p.invoiceNumber}
                        </span>
                        {' · '}
                        Payment {p.lineNumber} of {p.totalLines} · due{' '}
                        <span className={URGENCY_TEXT_CLASSES[payableUrgency(p.status, p.dueDate)]}>
                          {new Date(p.dueDate).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-medium text-gray-800">{formatPeso(p.amountDue)}</span>
                        <InstallmentStatusBadge status={p.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {upcomingPayables.length > 10 && (
                <Link
                  href={`/crm/customers/${id}/ledger`}
                  className="mt-3 inline-block text-[12px] text-prominent-orange-700 hover:underline"
                >
                  +{upcomingPayables.length - 10} more — View full customer ledger →
                </Link>
              )}
            </>
          )}
          {!accountsLoading && installmentAccounts.length > 0 && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-[12px] text-gray-400">
              This list only includes itemized due dates from POS-originated installment plans. This
              customer also has {installmentAccounts.length} CRM collections account
              {installmentAccounts.length !== 1 ? 's' : ''} on file — see aggregate balances in CRM
              Collections Accounts below.
            </p>
          )}
        </section>
      </div>

      {scheduleDetailTarget && (
        <InstallmentScheduleDetailModal
          schedule={scheduleDetailTarget}
          customerId={id}
          customerName={data.name}
          onClose={() => setScheduleDetailTarget(null)}
        />
      )}

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">CRM Collections Accounts</h2>
          {accountsLoading ? (
            <p className="py-4 text-center text-[13px] text-gray-400">Loading accounts…</p>
          ) : accountsError ? (
            <p className="py-4 text-center text-[13px] text-red-600">{accountsError}</p>
          ) : installmentAccounts.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No CRM collections accounts for this customer.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {installmentAccounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                >
                  <Link
                    href={`/crm/installment-accounts/${a.id}`}
                    className="font-mono font-medium text-prominent-orange-700 hover:underline"
                  >
                    {a.accountNumber}
                  </Link>
                  <span className="flex items-center gap-2 text-gray-600">
                    {a.collector ? `${a.collector.stubNumber} — ${a.collector.name}` : 'Unassigned'}
                    <span className="font-medium text-gray-800">
                      {formatPeso(Number(a.currentBalance))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Bank Details</h2>
          {!data.bankAccounts || data.bankAccounts.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No bank details on file. Add one from Edit.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.bankAccounts.map((acc) => (
                <li
                  key={acc.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
                >
                  <span className="font-medium text-gray-800">
                    {acc.bankName} — {acc.accountNumber}
                  </span>
                  <span className="flex items-center gap-2 text-gray-500">
                    {acc.accountName && <span>{acc.accountName}</span>}
                    {acc.isPrimary && (
                      <span className="rounded-full bg-prominent-orange-50 px-2 py-0.5 text-[11px] font-medium text-prominent-orange-700">
                        Primary
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Co-maker (Guarantor)</h2>
          {!data.coMakers || data.coMakers.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No co-maker on file. Add one from Edit.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.coMakers.map((cm) => (
                <li
                  key={cm.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
                >
                  <span className="font-medium text-gray-800">
                    {cm.name} — {cm.relationship}
                  </span>
                  <span className="flex items-center gap-2 text-gray-500">
                    <span>{cm.contactNumber}</span>
                    {cm.email && <span>{cm.email}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">ID & Consent</h2>
          {!data.idType && !data.idNumber && !data.idDocumentFile && !data.consentGiven ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No ID information on file. Add it from Edit.
            </p>
          ) : (
            <div className="space-y-2.5 text-[13px]">
              {(data.idType || data.idNumber) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{data.idType || 'ID'}</span>
                  {data.idNumber && <span className="text-gray-500">{data.idNumber}</span>}
                </div>
              )}
              {data.idDocumentFile && (
                <a
                  href={`/api/files/${data.idDocumentFile.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-prominent-purple-700 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {data.idDocumentFile.originalName}
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
              <div className="flex items-center gap-1.5 text-gray-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${data.consentGiven ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                {data.consentGiven
                  ? `Consent given${data.consentGivenAt ? ` on ${new Date(data.consentGivenAt).toLocaleDateString()}` : ''}`
                  : 'Consent not yet given'}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Transaction History</h2>
          {historyLoading ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              Loading transaction history…
            </p>
          ) : historyError ? (
            <p className="py-4 text-center text-[13px] text-red-600">{historyError}</p>
          ) : transactionHistory.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No transactions for this customer.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {transactionHistory.map((tx) =>
                  tx.kind === 'PAYMENT' ? (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-[13px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-800">
                          Payment received
                          {tx.reference ? ` — ${tx.reference}` : ''}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                          <span>
                            {new Date(tx.paymentDate).toLocaleDateString('en-PH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {tx.invoiceNumbers.length > 0 && (
                            <span className="truncate">{tx.invoiceNumbers.join(', ')}</span>
                          )}
                          {tx.cancelledAt && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                              cancelled
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-green-700">
                        {formatPeso(tx.amount)}
                      </span>
                    </li>
                  ) : (
                    <li
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-[13px] hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-800">
                          {summarizeTransactionItems(tx)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                          <span>
                            {new Date(tx.occurredAt ?? tx.createdAt).toLocaleDateString('en-PH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {tx.transactionType !== 'sale' && (
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${txTypeColor[tx.transactionType] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {tx.transactionType}
                            </span>
                          )}
                          {tx.status !== 'completed' && (
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${txStatusColor[tx.status] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {tx.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-gray-800">
                        {formatPeso(tx.totalAmount)}
                      </span>
                    </li>
                  )
                )}
              </ul>
              {transactionHistory.length >= 20 && (
                <p className="mt-2 text-center text-[11px] text-gray-400">
                  Showing the most recent 20 transactions.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {canDelete && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/60 p-5">
          <h2 className="text-[14px] font-semibold text-red-900">Danger Zone</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[13px] text-red-700">
              Deleting {data.name} is permanent and can&apos;t be undone from here.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete customer'}
            </button>
          </div>
          {deleteError && (
            <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
              {deleteError}
            </p>
          )}
        </div>
      )}

      <ScheduleReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        onCreated={reload}
        tenantId={tenantId}
        assignedTo={currentUserId}
        target={{ customerId: id }}
      />

      {selectedTransaction && posSession && (
        <TransactionDetail
          transaction={selectedTransaction}
          session={posSession}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={bold ? 'font-bold text-gray-900' : 'text-gray-500'}>{label}</dt>
      <dd
        className={
          bold ? 'text-right font-bold text-gray-900' : 'text-right font-medium text-gray-800'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function formatPeso(n: number) {
  return `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Scenario 23 Gap 2 — a schedule can now cover several items sharing one
// financing term (Gap 5), so there's no single "the" product anymore.
// Mirrors the "primary item +N more" convention already used for this exact
// shape elsewhere in POS (Release Approvals' Item/Serial column).
function productLabel(
  lines: { item: { name: string; brand: { name: string } | null } | null }[]
): string {
  const [first, ...rest] = lines
  if (!first?.item) return '—'
  const label = first.item.brand ? `${first.item.name} (${first.item.brand.name})` : first.item.name
  return rest.length > 0 ? `${label} +${rest.length} more` : label
}

// "Upcoming Payables" — a flattened, cross-plan view of every unpaid due
// date across ALL of a customer's installment schedules (the existing
// Installment Plans section only shows one schedule's due dates at a time,
// behind a click). Reuses the exact same installmentSchedules fetch — no
// new endpoint — just reshaped client-side: filter out settled/void lines,
// flatten every schedule's lines into one array, sort by due date.
type UpcomingPayable = {
  schedule: InstallmentSchedule
  invoiceId: string
  invoiceNumber: string
  lineNumber: number
  totalLines: number
  dueDate: string
  amountDue: number
  status: string
}

function flattenUpcomingPayables(schedules: InstallmentSchedule[]): UpcomingPayable[] {
  const payables: UpcomingPayable[] = []
  for (const schedule of schedules) {
    for (const line of schedule.lines) {
      if (['PAID', 'CANCELLED', 'DRAFT'].includes(line.arInvoice.status)) continue
      payables.push({
        schedule,
        invoiceId: line.arInvoice.id,
        invoiceNumber: line.arInvoice.invoiceNumber,
        lineNumber: line.lineNumber,
        totalLines: schedule.lines.length,
        dueDate: line.arInvoice.dueDate,
        amountDue: line.arInvoice.totalAmount - line.arInvoice.amountPaid,
        status: line.arInvoice.status,
      })
    }
  }
  return payables.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
}

// Due-date proximity accent — distinct from InstallmentStatusBadge, which
// already covers OVERDUE in red. The 7-day "due soon" threshold is a
// reasonable default, not a client-confirmed business rule.
type PayableUrgency = 'overdue' | 'dueSoon' | 'upcoming'

function payableUrgency(status: string, dueDate: string): PayableUrgency {
  if (status === 'OVERDUE') return 'overdue'
  const daysUntilDue = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntilDue <= 7 ? 'dueSoon' : 'upcoming'
}

const URGENCY_TEXT_CLASSES: Record<PayableUrgency, string> = {
  overdue: 'font-semibold text-red-600',
  dueSoon: 'font-semibold text-orange-600',
  upcoming: 'text-gray-700',
}

const URGENCY_STRIP_CLASSES: Record<PayableUrgency, string> = {
  overdue: 'border-red-200 bg-red-50',
  dueSoon: 'border-orange-200 bg-orange-50',
  upcoming: 'border-gray-200 bg-gray-50',
}

// ARInvoice.status is the underlying AR lifecycle state (DRAFT/SENT/PARTIAL/
// PAID/OVERDUE/CANCELLED) — "SENT" means "posted, awaiting payment", not that
// a notification went out. Relabeled to the Paid/Due/Overdue language a
// customer-facing installment schedule actually needs.
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}

// The plan's overall finished/ongoing state — distinct from
// InstallmentStatusBadge above, which marks one due-date line's own AR
// status. closed/early_closed/written_off all mean "no longer active", just
// via different paths (paid off on schedule, paid off early, or written off
// as uncollectible).
const INSTALLMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  early_closed: 'Paid Off Early',
  written_off: 'Written Off',
}

function InstallmentPlanStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    closed: 'bg-green-100 text-green-700',
    early_closed: 'bg-green-100 text-green-700',
    written_off: 'bg-red-100 text-red-700',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {INSTALLMENT_PLAN_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function InstallmentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    OVERDUE: 'bg-red-100 text-red-700',
    SENT: 'bg-gray-100 text-gray-600',
    DRAFT: 'bg-gray-100 text-gray-500',
    CANCELLED: 'bg-gray-100 text-gray-400',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

/** Scenario 23 Gap 2 (developer-requested redesign) — the full breakdown
 * behind an Installment Plans row's click: invoice numbers, per-due-date
 * status, and the rebate, all previously shown inline. Same modal chrome
 * as TransactionsList.tsx's TransactionDetail, for visual consistency with
 * the equivalent row-click-opens-detail pattern on the POS side. */
function InstallmentScheduleDetailModal({
  schedule,
  customerId,
  customerName,
  onClose,
}: {
  schedule: InstallmentSchedule
  customerId: string
  customerName: string
  onClose: () => void
}) {
  const router = useRouter()
  const totalPayments = schedule.lines.reduce(
    (sum, line) => sum + Number(line.arInvoice.amountPaid),
    0
  )
  const remainingBalance = Math.max(0, Number(schedule.totalPayable) - totalPayments)
  const hasUnpaidLine = schedule.lines.some(
    (line) => !['PAID', 'CANCELLED'].includes(line.arInvoice.status)
  )

  function goToCollections() {
    const params = new URLSearchParams({
      customerId,
      customerName,
      scheduleId: schedule.id,
    })
    router.push(`/pos/collections?${params.toString()}`)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-1 pr-8 text-lg font-bold text-gray-900">
            {productLabel(schedule.posTransactionLines)}
          </h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {schedule.posTransaction?.transactionNumber ?? schedule.id}
            </p>
            {schedule.installmentAccount && (
              <Link
                href={`/crm/customers/${customerId}/installments/${schedule.installmentAccount.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-prominent-orange-700 hover:bg-gray-50"
              >
                View customer ledger →
              </Link>
            )}
          </div>

          {/* Developer-requested (2026-08-09): the header's "+1 more" hides
              what the other item(s) actually are, and the combined
              Term/Down/Rebate/Total block below gives no sense of what
              each item cost. This list answers both — full item names and
              their own price, not a second/competing set of financing
              terms (the schedule below stays the single combined
              contract, per Gap 5's confirmed one-contract-per-term
              design). */}
          <div className="mb-4 rounded-xl border border-gray-200 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Items in this plan</p>
            <ul className="divide-y divide-gray-100" data-testid="installment-plan-items">
              {schedule.posTransactionLines.map((line) => (
                <li key={line.id} className="flex items-start justify-between py-1.5">
                  <div className="text-gray-700">
                    {line.item
                      ? line.item.brand
                        ? `${line.item.name} (${line.item.brand.name})`
                        : line.item.name
                      : '—'}
                    {line.quantity !== 1 && (
                      <span className="text-gray-400"> ×{line.quantity}</span>
                    )}
                    {line.serialNumber && (
                      <p className="font-mono text-[10px] text-purple-500">
                        SN: {line.serialNumber.serialNumber}
                        {line.secondarySerialNumber &&
                          ` / ${line.secondarySerialNumber.serialNumber}`}
                      </p>
                    )}
                  </div>
                  <span className="font-medium text-gray-800">{formatPeso(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
            <Row label="Term" value={`${schedule.termMonths} months`} />
            <Row label="Down payment" value={formatPeso(schedule.downPayment)} />
            {schedule.installmentAccount && (
              <Row label="Rebate" value={formatPeso(schedule.installmentAccount.ppd)} />
            )}
            <div className="border-t border-gray-200 pt-2">
              <Row label="Total price" value={formatPeso(schedule.totalPayable)} bold />
              <Row label="Total payments made" value={formatPeso(totalPayments)} />
              <Row label="Remaining balance" value={formatPeso(remainingBalance)} bold />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Due Dates</p>
            {hasUnpaidLine && (
              <p className="mb-2 text-[12px] text-gray-400">
                Click any due date to collect a payment — it always settles the earliest unpaid due
                first.
              </p>
            )}
            <ul className="divide-y divide-gray-100">
              {schedule.lines.map((line) => {
                const paid = Number(line.arInvoice.amountPaid)
                const total = Number(line.arInvoice.totalAmount)
                const isPartial = line.arInvoice.status === 'PARTIAL' && paid > 0 && paid < total
                const rowContent = (
                  <>
                    <span className="text-gray-700">
                      <span className="font-mono text-[11px] text-gray-400">
                        {line.arInvoice.invoiceNumber}
                      </span>
                      {' · '}
                      Payment {line.lineNumber} of {schedule.lines.length} · due{' '}
                      {new Date(line.arInvoice.dueDate).toLocaleDateString()}
                      {isPartial && (
                        <span className="block text-[11px] text-amber-600">
                          {formatPeso(paid)} paid · {formatPeso(total - paid)} remaining
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{formatPeso(total)}</span>
                      <InstallmentStatusBadge status={line.arInvoice.status} />
                    </span>
                  </>
                )
                return (
                  <li key={line.lineNumber} className="py-1.5 text-[13px]">
                    {hasUnpaidLine ? (
                      <button
                        type="button"
                        onClick={goToCollections}
                        className="flex w-full items-center justify-between gap-2 rounded-lg -mx-1 px-1 text-left hover:bg-gray-50"
                      >
                        {rowContent}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2 -mx-1 px-1">
                        {rowContent}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
