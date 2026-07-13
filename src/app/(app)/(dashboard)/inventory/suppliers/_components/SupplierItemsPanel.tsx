'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Star, Loader2, X } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import {
  getSupplierItems,
  addSupplierItem,
  updateSupplierItem,
  removeSupplierItem,
  type SupplierItemMapping,
} from '../_actions/get-supplier-items'

type ItemOption = { id: string; name: string; sku: string }

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const emptyForm = {
  itemId: '',
  supplierSku: '',
  unitPrice: '',
  leadTimeDays: '',
  isPreferred: false,
  notes: '',
}

export default function SupplierItemsPanel({
  supplierId,
  itemOptions,
  canUpdate,
}: {
  supplierId: string
  itemOptions: ItemOption[]
  canUpdate: boolean
}) {
  const [mappings, setMappings] = useState<SupplierItemMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<typeof emptyForm, 'itemId'>>({
    supplierSku: '',
    unitPrice: '',
    leadTimeDays: '',
    isPreferred: false,
    notes: '',
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await getSupplierItems(supplierId)
    setMappings(res.data ?? [])
    setIsLoading(false)
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd() {
    if (!form.itemId) return
    setIsSaving(true)
    const res = await addSupplierItem(supplierId, {
      itemId: form.itemId,
      supplierSku: form.supplierSku || undefined,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      isPreferred: form.isPreferred,
      notes: form.notes || undefined,
    })
    setIsSaving(false)
    if (res.success) {
      showToast({ title: 'Item linked', status: 'success' })
      setForm(emptyForm)
      setShowAddForm(false)
      await load()
    } else {
      showToast({ title: 'Failed to link item', description: res.message, status: 'error' })
    }
  }

  async function handleUpdate(mapping: SupplierItemMapping) {
    setIsSaving(true)
    const res = await updateSupplierItem(supplierId, mapping.itemId, {
      supplierSku: editForm.supplierSku || undefined,
      unitPrice: editForm.unitPrice ? Number(editForm.unitPrice) : undefined,
      leadTimeDays: editForm.leadTimeDays ? Number(editForm.leadTimeDays) : undefined,
      isPreferred: editForm.isPreferred,
      notes: editForm.notes || undefined,
    })
    setIsSaving(false)
    if (res.success) {
      showToast({ title: 'Mapping updated', status: 'success' })
      setEditingId(null)
      await load()
    } else {
      showToast({ title: 'Failed to update', description: res.message, status: 'error' })
    }
  }

  async function handleRemove(mapping: SupplierItemMapping) {
    if (!confirm(`Remove ${mapping.item.name} from this supplier?`)) return
    const res = await removeSupplierItem(supplierId, mapping.itemId)
    if (res.success) {
      showToast({ title: 'Mapping removed', status: 'success' })
      await load()
    } else {
      showToast({ title: 'Failed to remove', description: res.message, status: 'error' })
    }
  }

  function startEdit(m: SupplierItemMapping) {
    setEditingId(m.id)
    setEditForm({
      supplierSku: m.supplierSku ?? '',
      unitPrice: m.unitPrice != null ? String(m.unitPrice) : '',
      leadTimeDays: m.leadTimeDays != null ? String(m.leadTimeDays) : '',
      isPreferred: m.isPreferred,
      notes: m.notes ?? '',
    })
  }

  const linkedItemIds = new Set(mappings.map((m) => m.itemId))
  const availableItems = itemOptions.filter((i) => !linkedItemIds.has(i.id))

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{mappings.length} item(s) linked to this supplier</p>
        {canUpdate && !showAddForm && availableItems.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Link Item
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-zinc-800">Link an item</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Item <span className="text-red-500">*</span>
              </label>
              <select
                value={form.itemId}
                onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}
                className={`${fieldClass} bg-white`}
              >
                <option value="">Select item…</option>
                {availableItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Supplier SKU</label>
              <input
                type="text"
                value={form.supplierSku}
                onChange={(e) => setForm((f) => ({ ...f, supplierSku: e.target.value }))}
                placeholder="Supplier's own SKU"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Unit Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0.00"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Lead Time (days)
              </label>
              <input
                type="number"
                min="0"
                value={form.leadTimeDays}
                onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                placeholder="e.g. 7"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPreferred"
              checked={form.isPreferred}
              onChange={(e) => setForm((f) => ({ ...f, isPreferred: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-700"
            />
            <label htmlFor="isPreferred" className="text-xs text-zinc-700">
              Mark as preferred supplier for this item
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setForm(emptyForm)
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !form.itemId}
              className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Mappings list */}
      {mappings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
          No items linked yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Supplier SKU</th>
                <th className="px-4 py-2">Unit Price</th>
                <th className="px-4 py-2">Lead Time</th>
                <th className="px-4 py-2 text-center">Preferred</th>
                {canUpdate && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {mappings.map((m) =>
                editingId === m.id ? (
                  <tr key={m.id} className="bg-prominent-purple-50">
                    <td className="px-4 py-2 font-medium text-zinc-800">
                      <div>{m.item.name}</div>
                      <div className="text-xs text-zinc-400">{m.item.sku}</div>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.supplierSku}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, supplierSku: e.target.value }))
                        }
                        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.unitPrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: e.target.value }))}
                        className="w-24 rounded border border-zinc-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        value={editForm.leadTimeDays}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, leadTimeDays: e.target.value }))
                        }
                        className="w-20 rounded border border-zinc-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.isPreferred}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, isPreferred: e.target.checked }))
                        }
                        className="h-4 w-4 accent-prominent-purple-700"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdate(m)}
                          disabled={isSaving}
                          className="rounded px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-100 disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-zinc-800">{m.item.name}</div>
                      <div className="text-xs text-zinc-400">{m.item.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{m.supplierSku ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">
                      {m.unitPrice != null ? `₦${Number(m.unitPrice).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {m.leadTimeDays != null ? `${m.leadTimeDays}d` : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {m.isPreferred ? (
                        <Star className="mx-auto h-4 w-4 fill-amber-400 text-amber-400" />
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    {canUpdate && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(m)}
                            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
