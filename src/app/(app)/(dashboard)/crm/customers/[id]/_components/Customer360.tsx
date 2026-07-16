'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BellPlus, Pencil, Trash2 } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import type { Customer, Lead, Interaction, Reminder } from '@/src/schema/crm/types'
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

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[12px] text-gray-500">{data.customerCode}</div>
          <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {data.companyName ? `${data.companyName} · ` : ''}
            Source: {data.sourceChannel} · Status: {data.status}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <Row
              label="Credit limit"
              value={data.creditLimit ? `₱${Number(data.creditLimit).toLocaleString()}` : '—'}
            />
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
            <div className="space-y-4">
              {installmentSchedules.map((s) => (
                <div key={s.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="font-mono text-gray-500">
                      {s.posTransaction?.transactionNumber ?? s.id}
                    </span>
                    <span className="text-gray-500">
                      {s.termMonths} mo · {Number(s.factorRate).toFixed(2)}x · Down{' '}
                      {formatPeso(s.downPayment)} · Total {formatPeso(s.totalPayable)}
                    </span>
                  </div>
                  <ul className="mt-2 divide-y divide-gray-100">
                    {s.lines.map((line) => (
                      <li
                        key={line.lineNumber}
                        className="flex items-center justify-between py-1.5 text-[13px]"
                      >
                        <span className="text-gray-700">
                          Payment {line.lineNumber} of {s.lines.length} · due{' '}
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
                  <Link
                    href="/accounting/ar-invoices"
                    className="mt-2 inline-block text-[12px] text-prominent-orange-700 hover:underline"
                  >
                    View full AR ledger →
                  </Link>
                </div>
              ))}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  )
}

function formatPeso(n: number) {
  return `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
