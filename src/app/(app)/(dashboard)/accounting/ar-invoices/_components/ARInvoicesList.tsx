'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Send,
  DollarSign,
  ReceiptText,
  History,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  ARInvoices,
  CreditMemos,
  TaxRates,
  type ARInvoice,
  type ARPayment,
  type TaxRate,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { getCustomers, type Customer } from '@/src/libs/data/AccountingData'

export default function ARInvoicesList() {
  const [items, setItems] = useState<ARInvoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ARInvoice | null>(null)
  const [creating, setCreating] = useState(false)
  const [payingFor, setPayingFor] = useState<ARInvoice | null>(null)
  const [creditingFor, setCreditingFor] = useState<ARInvoice | null>(null)
  const [historyFor, setHistoryFor] = useState<ARInvoice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await ARInvoices.list()
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    getCustomers().then((r) => setCustomers(((r.data as any)?.items ?? r.data ?? []) as Customer[]))
  }, [load])

  const del = async (id: string) => {
    if (!confirm('Delete invoice?')) return
    const res = await ARInvoices.remove(id)
    if (!res.success) alert(res.message || res.error || 'Delete failed')
    load()
  }
  const send = async (id: string) => {
    const res = await ARInvoices.send(id)
    if (!res.success)
      alert(res.message || res.error || 'Send failed — check Account Mapping settings')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AR Invoices</h2>
          <p className="text-sm text-gray-500">Customer invoices and receivables.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Invoice #</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Invoice Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No invoices.
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-mono text-xs">{i.invoiceNumber}</td>
                  <td className="px-3 py-2">{i.customer?.name}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(i.invoiceDate)}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(i.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.amountPaid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(i.totalAmount - i.amountPaid)}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                      {i.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {i.status === 'DRAFT' && (
                        <button
                          onClick={() => send(i.id)}
                          title="Send"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {['SENT', 'PARTIAL', 'OVERDUE', 'PAID'].includes(i.status) && (
                        <button
                          onClick={() => setPayingFor(i)}
                          title="Record payment"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                      {(i.payments?.length ?? 0) > 0 && (
                        <button
                          onClick={() => setHistoryFor(i)}
                          title="Payment history"
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      )}
                      {['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status) && (
                        <button
                          onClick={() => setCreditingFor(i)}
                          title="Issue credit memo"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <ReceiptText className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(i)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(i.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <InvoiceFormDialog
          initial={editing}
          customers={customers}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
      {payingFor && (
        <PaymentDialog
          invoice={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => {
            setPayingFor(null)
            load()
          }}
        />
      )}
      {creditingFor && (
        <CreditMemoDialog
          invoice={creditingFor}
          onClose={() => setCreditingFor(null)}
          onSaved={() => {
            setCreditingFor(null)
            load()
          }}
        />
      )}
      {historyFor && (
        <PaymentHistoryModal
          invoice={historyFor}
          onClose={() => setHistoryFor(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function CreditMemoDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const outstanding = invoice.totalAmount - invoice.amountPaid
  const [form, setForm] = useState({
    amount: String(outstanding),
    reason: '',
    memoDate: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amount = Number(form.amount) || 0
  const remaining = outstanding - amount

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await CreditMemos.issue({
      arInvoiceId: invoice.id,
      amount,
      reason: form.reason || undefined,
      memoDate: form.memoDate,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to issue credit memo')
      return
    }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Issue Credit Memo</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-gray-600">
            Invoice <span className="font-mono">{invoice.invoiceNumber}</span> · Outstanding:{' '}
            <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>
          <Field label="Credit Amount *">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              max={outstanding}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="text-xs text-gray-500">
            Remaining after credit: <span className="font-semibold">{fmtMoney(remaining)}</span>
          </div>
          <Field label="Reason">
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Returns, discount, billing adjustment..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Memo Date *">
            <input
              required
              type="date"
              value={form.memoDate}
              onChange={(e) => setForm({ ...form, memoDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || amount <= 0 || amount > outstanding + 0.01}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Issuing...' : 'Issue Credit Memo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InvoiceFormDialog({
  initial,
  customers,
  onClose,
  onSaved,
}: {
  initial: ARInvoice | null
  customers: Customer[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    customerId: initial?.customerId ?? '',
    invoiceDate: initial?.invoiceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate:
      initial?.dueDate?.slice(0, 10) ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: initial?.description ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
    taxCode: (initial as any)?.taxCode ?? '',
    costCenter: initial?.costCenter ?? '',
  })
  const [saving, setSaving] = useState(false)
  // ACC-21 bridge: load tax rates so users can pick one instead of typing taxAmount manually
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  useEffect(() => {
    TaxRates.list(true).then((r) => setTaxRates(r.data ?? []))
  }, [])

  // When subtotal or tax code changes, recompute tax automatically
  const onTaxCodeChange = (code: string) => {
    const rate = taxRates.find((r) => r.code === code)
    const subtotal = Number(form.subtotal) || 0
    const tax = rate
      ? +(subtotal * (Number(rate.ratePercent) / 100)).toFixed(2)
      : Number(form.taxAmount) || 0
    setForm({ ...form, taxCode: code, taxAmount: rate ? String(tax) : form.taxAmount })
  }
  const onSubtotalChange = (val: string) => {
    const rate = taxRates.find((r) => r.code === form.taxCode)
    const subtotal = Number(val) || 0
    const tax = rate
      ? +(subtotal * (Number(rate.ratePercent) / 100)).toFixed(2)
      : Number(form.taxAmount) || 0
    setForm({ ...form, subtotal: val, taxAmount: rate ? String(tax) : form.taxAmount })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
    }
    if (initial) await ARInvoices.update(initial.id, payload)
    else await ARInvoices.create(payload)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Invoice' : 'New Invoice'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Customer *">
            <select
              required
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice Date *">
              <input
                required
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Due Date *">
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Tax Rate">
            <select
              value={form.taxCode}
              onChange={(e) => onTaxCodeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— None / Manual entry —</option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.code} — {t.name} ({Number(t.ratePercent).toFixed(2)}%)
                </option>
              ))}
            </select>
            {form.taxCode && (
              <p className="mt-1 text-xs text-gray-500">Tax auto-calculates as subtotal × rate.</p>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Subtotal *">
              <input
                required
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={(e) => onSubtotalChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Tax">
              <input
                type="number"
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                disabled={!!form.taxCode}
                className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${form.taxCode ? 'bg-gray-50 text-gray-600' : ''}`}
                title={form.taxCode ? 'Auto-calculated from tax rate' : 'Enter tax amount manually'}
              />
            </Field>
            <Field label="Cost Center">
              <input
                value={form.costCenter}
                onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="Dept / Project"
              />
            </Field>
          </div>
          <div className="text-right text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold text-gray-900">
              {fmtMoney((Number(form.subtotal) || 0) + (Number(form.taxAmount) || 0))}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: ARInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const outstanding = Math.max(invoice.totalAmount - invoice.amountPaid, 0)
  const isClosedAccount = invoice.status === 'PAID'
  const [form, setForm] = useState({
    amount: String(outstanding || ''),
    withholdingAmount: '0',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: '',
    reference: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overpaymentResult, setOverpaymentResult] = useState<{
    overpaidAmount: number
    wasClosedAccount: boolean
  } | null>(null)
  const totalApplied = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const wouldOverpay = totalApplied > outstanding + 0.01

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await ARInvoices.recordPayment(invoice.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
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
    onSaved()
  }

  if (overpaymentResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
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
              onClick={onSaved}
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record Payment</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {isClosedAccount && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This invoice is already fully paid. Any amount recorded here will be flagged as a
              closed-account overpayment.
            </div>
          )}
          <div className="text-sm text-gray-600">
            Outstanding: <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>
          <Field label="Cash Received *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Withholding Tax (if customer withheld)">
            <input
              type="number"
              step="0.01"
              value={form.withholdingAmount}
              onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="text-xs text-gray-500">
            Total applied to AR: <span className="font-semibold">{fmtMoney(totalApplied)}</span>
          </div>
          {wouldOverpay && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This exceeds the outstanding balance by {fmtMoney(totalApplied - outstanding)}. It
              will still be recorded and flagged as an overpayment — it will not be rejected.
            </div>
          )}
          <Field label="Payment Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Method">
            <input
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              placeholder="Cash, Bank Transfer..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Reference">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-emerald-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentHistoryModal({
  invoice,
  onClose,
  onChanged,
}: {
  invoice: ARInvoice
  onClose: () => void
  onChanged: () => void
}) {
  const [payments, setPayments] = useState<ARPayment[]>(invoice.payments ?? [])
  const [cancelling, setCancelling] = useState<string | null>(null)

  const cancel = async (payment: ARPayment) => {
    const reason = prompt('Reason for cancelling this overpayment (optional):') ?? undefined
    setCancelling(payment.id)
    const res = await ARInvoices.cancelPayment(invoice.id, payment.id, reason)
    setCancelling(null)
    if (!res.success) {
      alert(res.message || res.error || 'Cancel failed')
      return
    }
    setPayments((prev) =>
      prev.map((p) => (p.id === payment.id ? { ...p, cancelledAt: new Date().toISOString() } : p))
    )
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">Payment history — {invoice.invoiceNumber}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payments.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {fmtMoney(p.amount + p.withholdingAmount)}
                        {p.cancelledAt && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                            cancelled
                          </span>
                        )}
                        {p.isOverpayment && !p.cancelledAt && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            overpayment +{fmtMoney(p.overpaidAmount)}
                            {p.wasClosedAccount ? ' · closed account' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {fmtDate(p.paymentDate)}
                        {p.method ? ` · ${p.method}` : ''}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </div>
                      {p.cancelReason && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          Cancel reason: {p.cancelReason}
                        </div>
                      )}
                    </div>
                    {p.isOverpayment && !p.cancelledAt && (
                      <button
                        onClick={() => cancel(p)}
                        disabled={cancelling === p.id}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancelling === p.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
