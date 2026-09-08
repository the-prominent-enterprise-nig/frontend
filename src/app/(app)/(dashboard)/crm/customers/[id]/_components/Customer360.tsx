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
import { customersApi } from '@/src/libs/api/crm'
import { getCustomerHistoryWithPayments } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { TransactionDetail } from '@/src/app/(app)/(dashboard)/pos/_components/TransactionDetail'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { type SessionUser } from '@/src/libs/guards/permission'
import type { Customer, Lead, Reminder } from '@/src/schema/crm/types'
import type {
  InstallmentSchedule,
  CustomerHistoryItem,
  PosTransaction,
  PosInvoiceType,
  InstallmentProvider,
} from '@/src/schema/pos'
import {
  DUE_STATUS_LABELS,
  dueOutstanding,
  duePaid,
  dueStatus,
  isDueOpen,
  sumDuesPaid,
} from '@/src/libs/pos/installment-dues'

// One row per ITEM bought, not per transaction. The per-transaction view this
// replaced could only ever say "mixed" for a cart that financed one item and
// paid cash for another — invoiceType lives on PosTransactionLine, not just
// PosTransaction, so only a line-level list can show which item was which.
// Payments (CollectionReceipt rows) are deliberately not here; they live in
// Installment Plans, Upcoming Payables and the Customer Ledger.
type PurchasedItem = {
  key: string
  itemName: string | null
  sku: string | null
  serials: string[]
  quantity: number
  unitPrice: number
  lineTotal: number
  invoiceType: PosInvoiceType
  installmentProvider: InstallmentProvider | null
  termMonths: number | null
  occurredAt: string
  transactionNumber: string
  /** The parent sale. TransactionDetail re-fetches the full record itself
   * (react-query on summary.id) — the invoices it lists only come back from
   * findOne(), never from this history endpoint — so passing the summary is
   * enough and no extra fetch is needed here. */
  transaction: PosTransaction
  /** Refunds are stored with POSITIVE amounts and netted out by the caller
   * (see sessions.service.ts's `totalSales - totalRefunds`), so the sign is
   * applied here for display rather than read off the row. */
  isReturn: boolean
}

function flattenPurchasedItems(history: CustomerHistoryItem[]): PurchasedItem[] {
  const rows: PurchasedItem[] = []
  for (const tx of history) {
    if (tx.kind !== 'SALE') continue
    // Voided sales never happened; refunds/exchanges do belong here, signed.
    if (tx.status === 'voided') continue
    const isReturn = tx.transactionType === 'refund'
    const sign = isReturn ? -1 : 1
    for (const line of tx.lines ?? []) {
      rows.push({
        key: line.id,
        itemName: line.itemName,
        sku: line.sku ?? null,
        // Split-type items (aircon indoor+outdoor) carry two serials on one line.
        serials: [line.serialNumber, line.secondarySerialNumber].filter((sn): sn is string =>
          Boolean(sn)
        ),
        // Number() throughout — quantity/unitPrice/lineTotal are Prisma
        // Decimals and arrive as strings despite the `number` types here.
        quantity: sign * Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        lineTotal: sign * Number(line.lineTotal),
        invoiceType: line.invoiceType ?? tx.invoiceType ?? 'cash',
        installmentProvider: line.installmentProvider ?? null,
        termMonths: line.termMonths ?? null,
        occurredAt: tx.occurredAt ?? tx.createdAt,
        transactionNumber: tx.transactionNumber,
        transaction: tx,
        isReturn,
      })
    }
  }
  return rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

// Per-line payment mode. 'charge' is a retired checkout option kept for
// historical rows (see PosInvoiceType in schema.prisma), so it still needs a label.
const INVOICE_TYPE_LABEL: Record<PosInvoiceType, string> = {
  cash: 'Cash',
  charge: 'Charge',
  installment: 'Installment',
  mixed: 'Mixed',
}

const INVOICE_TYPE_CLASSES: Record<PosInvoiceType, string> = {
  cash: 'bg-emerald-50 text-emerald-700',
  charge: 'bg-amber-50 text-amber-700',
  installment: 'bg-blue-50 text-blue-700',
  mixed: 'bg-gray-100 text-gray-700',
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

  // CRM-01: last 20 transactions (server-capped, GET /pos/transactions/customer/:customerId/history-with-payments)
  // — covers cash/full-payment sales too, unlike Installment Plans above.
  // The endpoint still merges in Collections payments; this page now shows
  // only the sale lines from it (see flattenPurchasedItems).
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

  const purchasedItems = useMemo(
    () => flattenPurchasedItems(transactionHistory),
    [transactionHistory]
  )

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
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-gray-900">Transaction History</h2>
            <p className="text-[11px] text-gray-400">
              Items bought — click for the sales invoice · payments are in the{' '}
              <Link href={`/crm/customers/${id}/ledger`} className="underline hover:text-gray-600">
                Customer Ledger
              </Link>
            </p>
          </div>
          {historyLoading ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              Loading transaction history…
            </p>
          ) : historyError ? (
            <p className="py-4 text-center text-[13px] text-red-600">{historyError}</p>
          ) : purchasedItems.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              No items bought by this customer.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {purchasedItems.map((it) => (
                  <li
                    key={it.key}
                    onClick={() => setSelectedTransaction(it.transaction)}
                    className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-2.5 text-[13px] hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {it.itemName ?? 'Unknown item'}
                        {it.isReturn && (
                          <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            returned
                          </span>
                        )}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                        <span>
                          {new Date(it.occurredAt).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span>·</span>
                        <span>
                          {Math.abs(it.quantity)} × {formatPeso(it.unitPrice)}
                        </span>
                        {it.sku && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{it.sku}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="font-mono">{it.transactionNumber}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${INVOICE_TYPE_CLASSES[it.invoiceType]}`}
                        >
                          {INVOICE_TYPE_LABEL[it.invoiceType]}
                          {it.invoiceType === 'installment' && it.termMonths
                            ? ` · ${it.termMonths}mo`
                            : ''}
                          {it.installmentProvider === 'tpf' ? ' · TPF' : ''}
                        </span>
                      </div>
                      {it.serials.length > 0 && (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                          SN: {it.serials.join(' / ')}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 font-medium ${it.isReturn ? 'text-orange-600' : 'text-gray-800'}`}
                    >
                      {it.isReturn ? '-' : ''}
                      {formatPeso(Math.abs(it.lineTotal))}
                    </span>
                  </li>
                ))}
              </ul>
              {transactionHistory.length >= 20 && (
                <p className="mt-2 text-center text-[11px] text-gray-400">
                  Items from the most recent 20 transactions.
                </p>
              )}
            </>
          )}
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
                  <li key={p.key} className="py-2.5 text-[13px]">
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
  /** Unique per due. Scenario 47 made one ARInvoice cover a whole installment
   * sale — InstallmentScheduleLine.arInvoiceId lost its @unique — so the
   * invoice id repeats across every due of a plan and can no longer identify
   * one. The schedule plus the line number can. */
  key: string
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
      // Per DUE, not per invoice. Filtering on the shared invoice's status
      // kept a settled due listed until the WHOLE plan closed, and then
      // dropped all of its dues at once.
      if (!isDueOpen(line)) continue
      payables.push({
        key: `${schedule.id}-${line.lineNumber}`,
        schedule,
        invoiceId: line.arInvoice.id,
        invoiceNumber: line.arInvoice.invoiceNumber,
        lineNumber: line.lineNumber,
        totalLines: schedule.lines.length,
        // The LINE's own due date and amount, not the invoice's. They agreed
        // while every due had its own ARInvoice; since Scenario 47 gave the
        // whole sale one invoice they do not. Reading the invoice showed every
        // due carrying the same date, and each one carrying the entire
        // remaining balance — so a ₱12,000 plan with 10 dues left summed to
        // ₱120,000 in the header above.
        dueDate: line.dueDate,
        // Number() because InstallmentScheduleLine.amount is a Prisma
        // Decimal(15,2), which serializes to JSON as a STRING — the
        // `amount: number` in schema/pos is a lie. formatPeso() coerces
        // internally so single values looked fine, but the header's
        // reduce() was string-concatenating every due into one number
        // ("2140" x12 -> ₱214,021,402,140,214,...).
        amountDue: Number(line.amount),
        // Likewise the badge: the shared invoice sits at PARTIAL from the
        // moment the down payment posts (it opens at downPayment +
        // totalPayable, so amountPaid is never 0 and never the full
        // contract), which showed every due of every plan as "Partially
        // Paid" before a single month had been collected.
        status: dueStatus(line),
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
      {DUE_STATUS_LABELS[status] ?? status}
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
  // Every due of this plan points at the SAME ARInvoice, so summing
  // arInvoice.amountPaid across the lines counted the plan's whole
  // collected-to-date once per due (12x on a 12-month plan) and drove
  // Remaining balance to zero on day one. The dues' own paidAmount is the
  // per-month figure, and it nets against totalPayable because both exclude
  // the down payment — which settles no due and is reported on its own row
  // above.
  const totalPayments = sumDuesPaid(schedule.lines)
  const remainingBalance = Math.max(0, Number(schedule.totalPayable) - totalPayments)
  const hasUnpaidLine = schedule.lines.some(isDueOpen)

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
              <Row label="Installment payments made" value={formatPeso(totalPayments)} />
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
                // All four of these used to come off line.arInvoice — the
                // contract, shared by every due — so each row showed the
                // same date (the invoice's, which tracks the earliest
                // unpaid due), the same "Partially Paid" badge, and the
                // ENTIRE contract as its amount. They live on the line.
                const paid = duePaid(line)
                const total = Number(line.amount)
                const status = dueStatus(line)
                const isPartial = status === 'PARTIAL'
                const rowContent = (
                  <>
                    <span className="text-gray-700">
                      <span className="font-mono text-[11px] text-gray-400">
                        {line.arInvoice.invoiceNumber}
                      </span>
                      {' · '}
                      Payment {line.lineNumber} of {schedule.lines.length} · due{' '}
                      {new Date(line.dueDate).toLocaleDateString()}
                      {isPartial && (
                        <span className="block text-[11px] text-amber-600">
                          {formatPeso(paid)} paid · {formatPeso(dueOutstanding(line))} remaining
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{formatPeso(total)}</span>
                      <InstallmentStatusBadge status={status} />
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
