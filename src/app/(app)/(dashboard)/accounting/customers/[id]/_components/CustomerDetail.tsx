'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { getCustomerById, Customer } from '@/src/libs/data/AccountingData'
import { ARInvoices, fmtDate, fmtMoney, type ARInvoice } from '@/src/libs/data/AccountingV2Data'
import { customersApi } from '@/src/libs/api/crm'
import type { InstallmentSchedule } from '@/src/schema/pos'

const INSTALLMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  early_closed: 'Paid Off Early',
  written_off: 'Written Off',
}

const INSTALLMENT_PLAN_STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  early_closed: 'bg-green-100 text-green-700',
  written_off: 'bg-red-100 text-red-700',
}

// A schedule can cover several items sharing one financing term — mirrors
// the "primary item +N more" convention CRM's Customer360 already uses for
// this exact shape (Scenario 23 Gap 2).
function productLabel(
  lines: { item: { name: string; brand: { name: string } | null } | null }[]
): string {
  const [first, ...rest] = lines
  if (!first?.item) return '—'
  const label = first.item.brand ? `${first.item.name} (${first.item.brand.name})` : first.item.name
  return rest.length > 0 ? `${label} +${rest.length} more` : label
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
}

const LIFECYCLE_COLORS: Record<string, string> = {
  alive: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  dead: 'bg-gray-100 text-gray-600 ring-gray-200',
  employed: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export default function CustomerDetail({ id }: { id: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Own fetch of this customer's AR invoices — not borrowed from CRM's
  // Customer360 (which shows this same kind of receivables summary today
  // even though AR is Accounting's own data), so this page is
  // self-sufficient instead of sending accountants elsewhere to see what a
  // customer owes.
  const [invoices, setInvoices] = useState<ARInvoice[]>([])
  const [installmentSchedules, setInstallmentSchedules] = useState<InstallmentSchedule[]>([])

  useEffect(() => {
    customersApi.getInstallmentSchedules(id).then((res) => {
      if (res.success && res.data) setInstallmentSchedules(res.data)
    })
  }, [id])

  useEffect(() => {
    getCustomerById(id).then((res) => {
      if (res.success && res.data) {
        setCustomer(res.data)
      } else {
        setError(res.message || res.error || 'Customer not found')
      }
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    ARInvoices.list({ customerId: id }).then((res) => setInvoices(res.data?.items ?? []))
  }, [id])

  const { unpaid, outstandingTotal, nextDue, recentInvoices } = useMemo(() => {
    const sorted = [...invoices].sort(
      (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
    )
    const unpaidInvoices = invoices
      .filter((i) => i.totalAmount - i.amountPaid > 0.01)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    return {
      unpaid: unpaidInvoices,
      outstandingTotal: unpaidInvoices.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0),
      nextDue: unpaidInvoices[0] ?? null,
      recentInvoices: sorted.slice(0, 5),
    }
  }, [invoices])

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div>
        <Link
          href="/accounting/customers"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>

        {loading ? (
          <div className="mt-6 text-center text-zinc-500">Loading…</div>
        ) : error || !customer ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error ?? 'Customer not found'}
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                  {customer.lifecycleStatus && (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        LIFECYCLE_COLORS[customer.lifecycleStatus] ?? ''
                      }`}
                    >
                      {customer.lifecycleStatus}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {customer.customerCode || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/accounting/reports?tab=customer-statement&customerId=${customer.id}`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
                >
                  <FileText className="h-4 w-4" /> View Statement
                </Link>
              </div>
            </div>

            {nextDue ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
                <span className="text-zinc-700">
                  Next payment due{' '}
                  <span className="font-semibold">
                    {fmtMoney(nextDue.totalAmount - nextDue.amountPaid)}
                  </span>{' '}
                  on {fmtDate(nextDue.dueDate)}
                </span>
                <span className="flex items-center gap-3 text-zinc-500">
                  {unpaid.length} upcoming ·{' '}
                  <span className="font-medium">{fmtMoney(outstandingTotal)}</span> total
                  <Link
                    href={`/accounting/ar-invoices?customerId=${id}`}
                    className="flex items-center gap-1 font-medium text-purple-700 hover:underline"
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </span>
              </div>
            ) : (
              !loading &&
              invoices.length > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <CircleCheck className="h-4 w-4" /> No outstanding AR balance.
                </div>
              )
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailCard title="Contact">
                <Row label="Type" value={customer.customerType ?? 'individual'} />
                <Row label="Email" value={customer.email || '—'} />
                <Row label="Phone" value={customer.phone || '—'} />
                <Row label="Address" value={customer.address || '—'} />
                <Row label="Group ID" value={customer.groupId || '—'} />
              </DetailCard>

              <DetailCard title="Withholding Tax (CWT)">
                {customer.isWithholdingAgent ? (
                  <>
                    <Row
                      label="Status"
                      value={
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Withholding agent
                        </span>
                      }
                    />
                    <Row
                      label="Default rate"
                      value={
                        customer.defaultWithholdingRate != null
                          ? `${(Number(customer.defaultWithholdingRate) * 100).toFixed(2)}%`
                          : '—'
                      }
                    />
                    <Row label="Default ATC" value={customer.defaultWithholdingAtc || '—'} />
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">Not tagged as a withholding agent.</p>
                )}
              </DetailCard>

              <DetailCard title="Notes">
                <p className="whitespace-pre-wrap text-sm text-zinc-700">{customer.notes || '—'}</p>
              </DetailCard>

              <DetailCard title="Record">
                <Row label="Created" value={fmtDate(customer.createdAt)} />
                <Row label="Updated" value={fmtDate(customer.updatedAt)} />
              </DetailCard>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Installments</h2>
              {installmentSchedules.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-400">
                  No installment plans for this customer.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {installmentSchedules.map((s) => {
                    const row = (
                      <div className="flex w-full items-center justify-between gap-2 py-2.5 text-sm">
                        <div>
                          <p className="text-zinc-800">{productLabel(s.posTransactionLines)}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {s.termMonths} months · Total {fmtMoney(s.totalPayable)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {s.installmentAccount && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                INSTALLMENT_PLAN_STATUS_STYLES[s.installmentAccount.status] ??
                                'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {INSTALLMENT_PLAN_STATUS_LABELS[s.installmentAccount.status] ??
                                s.installmentAccount.status}
                            </span>
                          )}
                          {s.installmentAccount && (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}
                        </div>
                      </div>
                    )
                    return (
                      <li key={s.id}>
                        {s.installmentAccount ? (
                          <Link
                            href={`/accounting/customers/${id}/installments/${s.installmentAccount.id}`}
                            className="-mx-3 block rounded-lg bg-zinc-50 px-3 transition-colors hover:bg-zinc-100"
                          >
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Recent Invoices</h2>
                {invoices.length > 5 && (
                  <Link
                    href={`/accounting/ar-invoices?customerId=${id}`}
                    className="flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline"
                  >
                    View all {invoices.length} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {recentInvoices.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-400">No invoices yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {recentInvoices.map((inv) => (
                    <li key={inv.id}>
                      <Link
                        href={`/accounting/ar-invoices/${inv.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-zinc-50"
                      >
                        <div>
                          <span className="font-mono text-xs text-purple-700">
                            {inv.invoiceNumber}
                          </span>
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {inv.status}
                          </span>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {fmtDate(inv.invoiceDate)}
                          </div>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block font-semibold text-zinc-900">
                            {fmtMoney(inv.totalAmount)}
                          </span>
                          {inv.totalAmount - inv.amountPaid > 0.01 && (
                            <span className="text-xs text-red-600">
                              {fmtMoney(inv.totalAmount - inv.amountPaid)} due
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-900">{value}</span>
    </div>
  )
}
