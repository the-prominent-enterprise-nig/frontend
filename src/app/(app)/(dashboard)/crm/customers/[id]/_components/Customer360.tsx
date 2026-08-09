'use client'

import { useEffect, useState } from 'react'
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
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import AgingColorBadge from '@/src/components/crm/AgingColorBadge'
import type {
  Customer,
  Lead,
  Interaction,
  Reminder,
  InstallmentAccount,
} from '@/src/schema/crm/types'
import type { InstallmentSchedule } from '@/src/schema/pos'

type CustomerView = Customer & {
  leads: Lead[]
  interactions: Interaction[]
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
              direct, always-visible link regardless of purchase history. */}
          <Link
            href={`/accounting/ar-invoices?customerId=${id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Receipt className="h-4 w-4" />
            View AR Ledger
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Contact</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Email" value={data.email ?? '—'} />
            <Row label="Phone" value={data.phone ?? '—'} />
            <Row label="Tax exempt" value={data.isTaxExempt ? 'Yes' : 'No'} />
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Activity feed</h2>
          {data.interactions.length === 0 && (
            <p className="py-6 text-center text-[13px] text-gray-400">No interactions logged.</p>
          )}
          <ul className="divide-y divide-gray-100">
            {data.interactions.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex justify-between text-[12px] text-gray-500">
                  <span className="font-medium text-gray-700">{i.interactionType}</span>
                  <span>{new Date(i.occurredAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[13px] text-gray-800">{i.summary}</p>
              </li>
            ))}
          </ul>
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
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {scheduleDetailTarget && (
        <InstallmentScheduleDetailModal
          schedule={scheduleDetailTarget}
          customerId={id}
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
                    <AgingColorBadge color={a.aging?.color} />
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
  onClose,
}: {
  schedule: InstallmentSchedule
  customerId: string
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            {productLabel(schedule.posTransactionLines)}
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            {schedule.posTransaction?.transactionNumber ?? schedule.id}
          </p>

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
                <li key={line.id} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-700">
                    {line.item
                      ? line.item.brand
                        ? `${line.item.name} (${line.item.brand.name})`
                        : line.item.name
                      : '—'}
                    {line.quantity !== 1 && (
                      <span className="text-gray-400"> ×{line.quantity}</span>
                    )}
                  </span>
                  <span className="font-medium text-gray-800">{formatPeso(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
            <Row label="Term" value={`${schedule.termMonths} months`} />
            <Row label="Factor rate" value={`${Number(schedule.factorRate).toFixed(2)}x`} />
            <Row label="Down payment" value={formatPeso(schedule.downPayment)} />
            {schedule.installmentAccount && (
              <Row label="Rebate" value={formatPeso(schedule.installmentAccount.ppd)} />
            )}
            <div className="border-t border-gray-200 pt-2">
              <Row label="Total" value={formatPeso(schedule.totalPayable)} bold />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Due Dates</p>
            <ul className="divide-y divide-gray-100">
              {schedule.lines.map((line) => (
                <li
                  key={line.lineNumber}
                  className="flex items-center justify-between py-1.5 text-[13px]"
                >
                  <span className="text-gray-700">
                    <span className="font-mono text-[11px] text-gray-400">
                      {line.arInvoice.invoiceNumber}
                    </span>
                    {' · '}
                    Payment {line.lineNumber} of {schedule.lines.length} · due{' '}
                    {new Date(line.arInvoice.dueDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {formatPeso(line.arInvoice.totalAmount)}
                    </span>
                    <InstallmentStatusBadge status={line.arInvoice.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href={`/accounting/ar-invoices?customerId=${customerId}`}
            className="mt-4 inline-block text-[12px] text-prominent-orange-700 hover:underline"
          >
            View full AR ledger →
          </Link>
        </div>
      </div>
    </>
  )
}
