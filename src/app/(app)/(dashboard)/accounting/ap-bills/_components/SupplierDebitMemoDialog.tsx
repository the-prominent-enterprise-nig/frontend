'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { SupplierDebitMemos, type APBill, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { ItemSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'

// Scenario 10 (Purchasing & AP) Part 9 — supplier returns. Mirrors the
// existing Credit Memo dialog on the AR side (ARInvoicesList.tsx), but also
// asks for item/warehouse/quantity since a supplier return has an inventory
// side-effect a customer credit memo doesn't.
export default function SupplierDebitMemoDialog({
  bill,
  onClose,
  onSaved,
}: {
  bill: APBill
  onClose: () => void
  onSaved: () => void
}) {
  const outstanding = bill.totalAmount - bill.amountPaid
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    itemId: '',
    warehouseId: '',
    quantity: '1',
    amount: String(outstanding),
    reason: '',
    memoDate: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWarehouses({ limit: 200, status: 'active' }).then((r) =>
      setWarehouses((r.data?.data ?? []).map((w) => ({ id: w.id, name: w.name })))
    )
  }, [])

  const amount = Number(form.amount) || 0
  const remaining = outstanding - amount

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await SupplierDebitMemos.issue({
      apBillId: bill.id,
      itemId: form.itemId,
      warehouseId: form.warehouseId,
      quantity: Number(form.quantity),
      amount,
      reason: form.reason || undefined,
      memoDate: form.memoDate,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to issue supplier debit memo')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Issue Supplier Debit Memo</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-gray-600">
            Bill <span className="font-mono">{bill.billNumber}</span> · Outstanding:{' '}
            <span className="font-semibold">{fmtMoney(outstanding)}</span>
          </div>
          <Field label="Item Returned *">
            <ItemSearchCombobox
              value={form.itemId}
              onChange={(id) => setForm({ ...form, itemId: id })}
            />
          </Field>
          <Field label="Warehouse *">
            <select
              required
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity Returned *">
            <input
              required
              type="number"
              step="1"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Debit Amount *">
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
            Remaining owed after this debit:{' '}
            <span className="font-semibold">{fmtMoney(remaining)}</span>
          </div>
          <Field label="Reason">
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Defective units, wrong shipment, etc."
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
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-amber-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Issue Debit Memo'}
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
