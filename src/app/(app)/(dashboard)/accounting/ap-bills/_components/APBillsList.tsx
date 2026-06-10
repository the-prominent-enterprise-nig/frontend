'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, Inbox, DollarSign, X } from 'lucide-react'
import { APBills, type APBill, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getVendors, type Vendor } from '@/src/libs/data/AccountingData'

export default function APBillsList() {
  const [items, setItems] = useState<APBill[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<APBill | null>(null)
  const [creating, setCreating] = useState(false)
  const [payingFor, setPayingFor] = useState<APBill | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await APBills.list()
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    getVendors().then((r) => setVendors(((r.data as any)?.items ?? r.data ?? []) as Vendor[]))
  }, [load])

  const del = async (id: string) => {
    if (!confirm('Delete bill?')) return
    const res = await APBills.remove(id)
    if (!res.success) alert(res.message || res.error || 'Delete failed')
    load()
  }
  const receive = async (id: string) => {
    const res = await APBills.receive(id)
    if (!res.success)
      alert(res.message || res.error || 'Receive failed — check Account Mapping settings')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AP Bills</h2>
          <p className="text-sm text-gray-500">Vendor bills and payables.</p>
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
            <Plus className="w-4 h-4" /> New Bill
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Bill #</th>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-left">Bill Date</th>
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
                  No bills.
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono text-xs">{b.billNumber}</td>
                  <td className="px-3 py-2">{b.vendor?.name}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.billDate)}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.amountPaid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount - b.amountPaid)}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {b.status === 'DRAFT' && (
                        <button
                          onClick={() => receive(b.id)}
                          title="Receive"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Inbox className="w-4 h-4" />
                        </button>
                      )}
                      {['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(b.status) && (
                        <button
                          onClick={() => setPayingFor(b)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(b)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(b.id)}
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
        <BillForm
          initial={editing}
          vendors={vendors}
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
        <PayBill
          bill={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => {
            setPayingFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function BillForm({
  initial,
  vendors,
  onClose,
  onSaved,
}: {
  initial: APBill | null
  vendors: Vendor[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    vendorId: initial?.vendorId ?? '',
    billDate: initial?.billDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate:
      initial?.dueDate?.slice(0, 10) ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: initial?.description ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
    costCenter: initial?.costCenter ?? '',
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
    }
    if (initial) await APBills.update(initial.id, payload)
    else await APBills.create(payload)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Bill' : 'New Bill'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Vendor *">
            <select
              required
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill Date *">
              <input
                required
                type="date"
                value={form.billDate}
                onChange={(e) => setForm({ ...form, billDate: e.target.value })}
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="Subtotal *">
              <input
                required
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Tax">
              <input
                type="number"
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Cost Center">
              <input
                value={form.costCenter}
                onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
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

function PayBill({
  bill,
  onClose,
  onSaved,
}: {
  bill: APBill
  onClose: () => void
  onSaved: () => void
}) {
  const out = bill.totalAmount - bill.amountPaid
  const [form, setForm] = useState({
    amount: String(out),
    withholdingAmount: '0',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: '',
    reference: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const totalSettled = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await APBills.recordPayment(bill.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
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
          <div className="text-sm text-gray-600">
            Outstanding: <span className="font-semibold">{fmtMoney(out)}</span>
          </div>
          <Field label="Cash Paid *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Withholding Tax (if you withheld from supplier)">
            <input
              type="number"
              step="0.01"
              value={form.withholdingAmount}
              onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="text-xs text-gray-500">
            Total settled on AP: <span className="font-semibold">{fmtMoney(totalSettled)}</span>
          </div>
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

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
