'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, User, Loader2, AlertTriangle } from 'lucide-react'
import {
  ARInvoices,
  BankAccounts,
  type ARInvoice,
  type ARInvoiceCustomerResult,
  type BankAccount,
  type PaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

/** Scenario 44 Part 1 — a real, dedicated "New Receipt" page (not a modal),
 * reached directly from the AR Invoices landing page without first routing
 * through a customer's own invoice list. One whole form, not a multi-step
 * wizard: Customer and Invoice are just its first two fields — picking one
 * doesn't hide the rest of the form, it just populates the Invoice dropdown
 * and defaults Cash Received to the picked invoice's outstanding balance.
 * Same `recordPayment` call and fields the existing per-invoice
 * PaymentDialog uses. */
export default function NewReceiptForm() {
  const router = useRouter()
  const [customer, setCustomer] = useState<ARInvoiceCustomerResult | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<ARInvoiceCustomerResult[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  const [invoices, setInvoices] = useState<ARInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const invoice = invoices.find((i) => i.id === invoiceId) ?? null
  const outstanding = invoice ? Math.max(invoice.totalAmount - invoice.amountPaid, 0) : 0

  const [form, setForm] = useState({
    amount: '',
    withholdingAmount: '0',
    withholdingCertificateNo: '',
    withholdingCertificateStatus: '' as '' | 'pending' | 'received',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'CASH' as PaymentMethod,
    reference: '',
    notes: '',
    bankAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentResult, setOverpaymentResult] = useState<{
    overpaidAmount: number
    wasClosedAccount: boolean
  } | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
  }, [])

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await ARInvoices.searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  useEffect(() => {
    if (!customer) {
      setInvoices([])
      setInvoiceId('')
      return
    }
    setLoadingInvoices(true)
    ARInvoices.list({ customerId: customer.id }).then((res) => {
      // Same statuses InvoiceRow's own "Record payment" action is gated on
      // — a DRAFT has nothing to collect yet, PAID has nothing outstanding.
      const open = (res.data?.items ?? []).filter((i) =>
        ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status)
      )
      setInvoices(open)
      setLoadingInvoices(false)
    })
  }, [customer])

  // Picking (or changing) the invoice defaults Cash Received to what's
  // actually outstanding on it — the rest of the form stays as typed.
  useEffect(() => {
    if (invoice) setForm((f) => ({ ...f, amount: String(outstanding) }))
  }, [invoiceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalApplied = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const wouldOverpay = !!invoice && totalApplied > outstanding + 0.01
  const requiresBankAccount = form.method !== 'CASH'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) {
      setError('Pick a customer and an invoice first.')
      return
    }
    if (requiresBankAccount && !form.bankAccountId) {
      setError(`Source of Fund is required for ${form.method.replace('_', ' ')} payments.`)
      return
    }
    setSaving(true)
    setError(null)
    const res = await ARInvoices.recordPayment(invoice.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
      withholdingCertificateNo: form.withholdingCertificateNo || undefined,
      withholdingCertificateStatus: form.withholdingCertificateStatus || undefined,
      bankAccountId: form.bankAccountId || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    if (res.data?.overpayment) {
      setOverpaymentResult(res.data.overpayment)
      return
    }
    router.push('/accounting/ar-invoices')
  }

  if (overpaymentResult) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            {overpaymentResult.wasClosedAccount
              ? 'Overpayment on a closed account'
              : 'Payment recorded as an overpayment'}
          </h3>
          <p className="text-sm text-gray-600">
            This payment was <span className="font-semibold">not rejected</span> (to keep the
            invoice numbering unbroken), but exceeds what was owed by{' '}
            <span className="font-semibold">{fmtMoney(overpaymentResult.overpaidAmount)}</span>.
            {overpaymentResult.wasClosedAccount &&
              ' The invoice was already fully paid before this payment.'}{' '}
            A manager can cancel this specific payment from the payment history view if needed.
          </p>
          <button
            onClick={() => router.push('/accounting/ar-invoices')}
            className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Got it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/ar-invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AR Invoices
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">New Receipt</h1>
      <p className="mt-1 text-sm text-gray-500">
        Record a collection against a customer&apos;s invoice.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5"
      >
        <Field label="Customer *">
          {customer ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900">{customer.name}</span>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="text-xs font-medium text-purple-700 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-purple-500 focus:outline-none"
                placeholder="Search by name or phone…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
              />
              {searchingCustomers && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              )}
              {customerSearchOpen && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {customerResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">No customers found</p>
                  ) : (
                    customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onMouseDown={() => {
                          setCustomer(c)
                          setCustomerSearch('')
                          setCustomerSearchOpen(false)
                        }}
                      >
                        <User size={13} className="shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="Invoice *">
          <select
            required
            disabled={!customer || loadingInvoices}
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {!customer
                ? 'Pick a customer first'
                : loadingInvoices
                  ? 'Loading invoices…'
                  : invoices.length === 0
                    ? 'No open invoices for this customer'
                    : '— Select —'}
            </option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoiceNumber} — Due {fmtDate(i.dueDate)} — Outstanding{' '}
                {fmtMoney(i.totalAmount - i.amountPaid)}
              </option>
            ))}
          </select>
        </Field>

        {invoice && (
          <div className="text-sm text-gray-600">
            Outstanding: <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cash Received *">
            <input
              required
              disabled={!invoice}
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </Field>
          <Field label="Withholding Tax (if customer withheld)">
            <input
              disabled={!invoice}
              type="number"
              step="0.01"
              value={form.withholdingAmount}
              onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </Field>
        </div>
        {Number(form.withholdingAmount) > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="2307 Certificate No.">
              <input
                type="text"
                value={form.withholdingCertificateNo}
                onChange={(e) => setForm({ ...form, withholdingCertificateNo: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Certificate Status">
              <select
                value={form.withholdingCertificateStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    withholdingCertificateStatus: e.target.value as '' | 'pending' | 'received',
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Not tracked —</option>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
              </select>
            </Field>
          </div>
        )}
        {invoice && (
          <div className="text-xs text-gray-500">
            Total applied to AR: <span className="font-semibold">{fmtMoney(totalApplied)}</span>
          </div>
        )}
        {wouldOverpay && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This exceeds the outstanding balance by {fmtMoney(totalApplied - outstanding)}. It will
            still be recorded and flagged as an overpayment — it will not be rejected.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Date *">
            <input
              required
              disabled={!invoice}
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </Field>
          <Field label="Method">
            <select
              disabled={!invoice}
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference">
            <input
              disabled={!invoice}
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </Field>
          <Field label={requiresBankAccount ? 'Source of Fund *' : 'Source of Fund'}>
            <select
              required={requiresBankAccount}
              disabled={!invoice}
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">{requiresBankAccount ? '— Select —' : '— Not tracked —'}</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.bankName} ({acc.accountNumber})
                </option>
              ))}
            </select>
            {invoice && requiresBankAccount && !form.bankAccountId && (
              <p className="mt-1 text-[12px] text-amber-700">
                Required for {form.method.replace('_', ' ').toLowerCase()} payments, so this shows
                up in Bank Reconciliation.
              </p>
            )}
          </Field>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="submit"
            disabled={!invoice || saving}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record Receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
