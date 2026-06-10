'use client'

import { useState } from 'react'
import { X, Calculator, AlertTriangle } from 'lucide-react'
import { COSTING_METHOD_LABELS, type CogsPreview } from '@/src/schema/inventory/costing'
import type { IssueStockFormValues } from '@/src/schema/inventory/costing'

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ItemOption {
  id: string
  sku: string
  name: string
}
interface WarehouseOption {
  id: string
  code: string
  name: string
}

interface Props {
  onClose: () => void
  onIssue: (data: IssueStockFormValues) => Promise<any>
  onPreview: (params: {
    itemId: string
    warehouseId: string
    quantity: number
  }) => Promise<{ data?: CogsPreview; success?: boolean; error?: string }>
  isIssuing: boolean
  itemOptions: ItemOption[]
  warehouseOptions: WarehouseOption[]
}

export default function IssueStockModal({
  onClose,
  onIssue,
  onPreview,
  isIssuing,
  itemOptions,
  warehouseOptions,
}: Props) {
  const [form, setForm] = useState<{
    itemId: string
    warehouseId: string
    quantity: string
    referenceType: string
    referenceId: string
    notes: string
  }>({
    itemId: '',
    warehouseId: '',
    quantity: '',
    referenceType: '',
    referenceId: '',
    notes: '',
  })

  const [preview, setPreview] = useState<CogsPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
    setPreview(null)
    setPreviewError(null)
    setConfirmed(false)
  }

  async function handlePreview() {
    if (!form.itemId || !form.warehouseId || !form.quantity) return
    const qty = Number(form.quantity)
    if (isNaN(qty) || qty <= 0) return
    setIsPreviewing(true)
    setPreviewError(null)
    try {
      const result = await onPreview({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
      })
      if (result.success && result.data) {
        setPreview(result.data)
      } else {
        setPreviewError(result.error ?? 'Preview failed')
      }
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleSubmit() {
    if (!preview || !confirmed) return
    await onIssue({
      itemId: form.itemId,
      warehouseId: form.warehouseId,
      quantity: Number(form.quantity),
      referenceType: form.referenceType || undefined,
      referenceId: form.referenceId || undefined,
      notes: form.notes || undefined,
    })
    onClose()
  }

  const canPreview = !!form.itemId && !!form.warehouseId && Number(form.quantity) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Issue Stock</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Item */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Item</label>
            <select
              value={form.itemId}
              onChange={(e) => set('itemId', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            >
              <option value="">Select item…</option>
              {itemOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.name}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Source Warehouse</label>
            <select
              value={form.warehouseId}
              onChange={(e) => set('warehouseId', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            >
              <option value="">Select warehouse…</option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Quantity</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reference Type</label>
              <input
                type="text"
                value={form.referenceType}
                onChange={(e) => set('referenceType', e.target.value)}
                placeholder="e.g. sale_order"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reference ID</label>
              <input
                type="text"
                value={form.referenceId}
                onChange={(e) => set('referenceId', e.target.value)}
                placeholder="SO-0001"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes…"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>

          {/* Preview button */}
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview || isPreviewing}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-prominent-purple-200 bg-prominent-purple-50 px-4 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-100 disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            {isPreviewing ? 'Calculating…' : 'Preview COGS'}
          </button>

          {/* Preview result */}
          {preview && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                COGS Estimate — {COSTING_METHOD_LABELS[preview.costingMethod]}
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-zinc-500">Qty</p>
                  <p className="text-lg font-bold text-zinc-900">{preview.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Unit Cost</p>
                  <p className="text-lg font-bold text-zinc-900">₱{fmt(preview.unitCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total COGS</p>
                  <p className="text-lg font-bold text-prominent-purple-700">
                    ₱{fmt(preview.cogsAmount)}
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-600"
                />
                <span className="text-sm text-zinc-700">Confirm and record this stock issue</span>
              </label>
            </div>
          )}

          {/* Preview error */}
          {previewError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{previewError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!preview || !confirmed || isIssuing}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {isIssuing ? 'Recording…' : 'Record Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}
