'use client'

import { useState } from 'react'
import { Search, User, AlertTriangle, Banknote } from 'lucide-react'
import { searchCustomers } from '../../_actions/pos-actions'
import { useCustomerInstallmentSchedules } from '../../_hooks/usePos'
import { ARInvoices, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import type { PosCustomer, InstallmentScheduleLineWithInvoice } from '@/src/schema/pos'

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
  SENT: 'bg-gray-100 text-gray-600',
  DRAFT: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-400',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function CollectionsScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PosCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [customer, setCustomer] = useState<PosCustomer | null>(null)
  const [collectingLine, setCollectingLine] = useState<InstallmentScheduleLineWithInvoice | null>(
    null
  )

  const schedulesQuery = useCustomerInstallmentSchedules(customer?.id)

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const res = await searchCustomers(q.trim())
    setSearching(false)
    if (res.success && res.data) setResults(res.data)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Collections</h1>
        <p className="mt-1 text-sm text-gray-500">
          Look up a customer and collect payment against an existing installment due — payments that
          exceed what&apos;s owed are recorded, not rejected, and flagged as an overpayment.
        </p>
      </header>

      {!customer ? (
        <div className="mt-6 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search customer by name or phone…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          {searching && <p className="mt-2 text-[13px] text-gray-400">Searching…</p>}
          {!searching && results.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setCustomer(c)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    <span>
                      <span className="block text-[13px] font-medium text-gray-900">
                        {c.name || [c.firstName, c.lastName].filter(Boolean).join(' ')}
                      </span>
                      {c.phone && (
                        <span className="block text-[12px] text-gray-500">{c.phone}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div>
              <div className="text-[13px] font-semibold text-gray-900">
                {customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(' ')}
              </div>
              {customer.phone && <div className="text-[12px] text-gray-500">{customer.phone}</div>}
            </div>
            <button
              onClick={() => {
                setCustomer(null)
                setResults([])
                setQuery('')
              }}
              className="text-[13px] font-medium text-prominent-orange-700 hover:underline"
            >
              Change customer
            </button>
          </div>

          {schedulesQuery.isLoading && (
            <p className="py-8 text-center text-[13px] text-gray-400">Loading installment plans…</p>
          )}
          {!schedulesQuery.isLoading &&
            (!schedulesQuery.data?.success || (schedulesQuery.data.data ?? []).length === 0) && (
              <p className="py-8 text-center text-[13px] text-gray-400">
                No installment plans for this customer.
              </p>
            )}

          <div className="space-y-4">
            {schedulesQuery.data?.success &&
              (schedulesQuery.data.data ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-gray-500">
                    <span className="font-mono">{s.posTransaction?.transactionNumber ?? s.id}</span>
                    <span>
                      {s.termMonths} mo · Monthly {fmtMoney(s.monthlyInstallment)}
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {s.lines.map((line) => {
                      const outstanding = Math.max(
                        line.arInvoice.totalAmount - line.arInvoice.amountPaid,
                        0
                      )
                      const collectable = !['DRAFT', 'CANCELLED'].includes(line.arInvoice.status)
                      return (
                        <li
                          key={line.lineNumber}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-[13px] text-gray-800">
                              Payment {line.lineNumber} of {s.lines.length} · due{' '}
                              {fmtDate(line.arInvoice.dueDate)}
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-gray-500">
                              <StatusBadge status={line.arInvoice.status} />
                              <span>
                                {fmtMoney(line.arInvoice.amountPaid)} of{' '}
                                {fmtMoney(line.arInvoice.totalAmount)} paid
                              </span>
                            </div>
                          </div>
                          {collectable && (
                            <button
                              onClick={() => setCollectingLine(line)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              Collect
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}

      {collectingLine && (
        <CollectPaymentModal
          line={collectingLine}
          onClose={() => setCollectingLine(null)}
          onCollected={() => {
            setCollectingLine(null)
            schedulesQuery.refetch()
          }}
        />
      )}
    </div>
  )
}

function CollectPaymentModal({
  line,
  onClose,
  onCollected,
}: {
  line: InstallmentScheduleLineWithInvoice
  onClose: () => void
  onCollected: () => void
}) {
  const invoice = line.arInvoice
  const outstanding = Math.max(invoice.totalAmount - invoice.amountPaid, 0)
  const isClosedAccount = invoice.status === 'PAID'
  const [form, setForm] = useState({
    amount: String(outstanding || ''),
    withholdingAmount: '0',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'Cash',
    reference: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentResult, setOverpaymentResult] = useState<{
    overpaidAmount: number
    wasClosedAccount: boolean
  } | null>(null)

  const totalApplied = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const wouldOverpay = totalApplied > outstanding + 0.01

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await ARInvoices.recordPayment(invoice.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
    })
    setSubmitting(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to collect payment')
      return
    }
    if (res.data?.overpayment) {
      setOverpaymentResult(res.data.overpayment)
      return
    }
    onCollected()
  }

  if (overpaymentResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              {overpaymentResult.wasClosedAccount
                ? 'Overpayment on a closed account'
                : 'Payment recorded as an overpayment'}
            </h3>
            <p className="text-sm text-gray-600">
              This payment was <span className="font-semibold">not rejected</span> — it exceeds what
              was owed by{' '}
              <span className="font-semibold">{fmtMoney(overpaymentResult.overpaidAmount)}</span>.
              {overpaymentResult.wasClosedAccount &&
                ' This installment due was already fully paid before this payment.'}{' '}
              A manager can cancel this specific payment from Accounting → AR Invoices if needed.
            </p>
            <button
              onClick={onCollected}
              className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Collect payment</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          {isClosedAccount && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This due is already fully paid. Anything collected here will be flagged as a
              closed-account overpayment.
            </div>
          )}
          <div className="text-[13px] text-gray-600">
            Outstanding:{' '}
            <span className="font-semibold text-gray-900">{fmtMoney(outstanding)}</span>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Amount received *</label>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          {wouldOverpay && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This exceeds the outstanding balance by {fmtMoney(totalApplied - outstanding)}. It
              will still be recorded and flagged as an overpayment.
            </div>
          )}
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Method</label>
            <input
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              placeholder="Cash, Card, Bank Transfer…"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Reference</label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="OR number"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Collecting…' : 'Collect payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
