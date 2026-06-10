'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { purchaseOrdersApi, purchaseRequestsApi } from '@/src/libs/api/procurement'
import {
  ItemPicker,
  SupplierPicker,
  WarehousePicker,
} from '@/src/components/procurement/EntityPicker'
import type { PurchaseRequest } from '@/src/schema/procurement/types'

type LineDraft = {
  itemId: string
  itemLabel: string
  quantity: string
  unitPrice: string
}

const emptyLine: LineDraft = {
  itemId: '',
  itemLabel: '',
  quantity: '',
  unitPrice: '',
}

export default function NewPurchaseOrderForm({
  tenantId,
  fromPrId,
}: {
  tenantId: string
  fromPrId?: string
}) {
  const router = useRouter()
  const [code, setCode] = useState(
    `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`
  )
  const [supplierId, setSupplierId] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pr, setPr] = useState<PurchaseRequest | null>(null)

  // If we came from a PR, prefill items.
  useEffect(() => {
    if (!fromPrId) return
    purchaseRequestsApi.get(fromPrId).then((res) => {
      if (res.success && res.data) {
        setPr(res.data)
        setLines(
          res.data.lines?.map((l) => ({
            itemId: l.itemId,
            itemLabel: l.item ? `${l.item.sku} — ${l.item.name}` : l.itemId,
            quantity: String(l.quantity),
            unitPrice: '',
          })) ?? [{ ...emptyLine }]
        )
        if (res.data.lines?.[0]?.suggestedSupplierId) {
          setSupplierId(res.data.lines[0].suggestedSupplierId)
        }
      }
    })
  }, [fromPrId])

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const subtotal = lines.reduce(
    (s, l) =>
      s +
      (Number(l.quantity) > 0 && Number(l.unitPrice) >= 0
        ? Number(l.quantity) * Number(l.unitPrice)
        : 0),
    0
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supplierId) {
      setError('Supplier UUID is required')
      return
    }

    if (fromPrId && pr) {
      // Convert-from-PR path
      const prices: Record<string, number> = {}
      for (const l of lines) {
        if (!l.itemId || !l.unitPrice) {
          setError('All lines need a unit price to convert')
          return
        }
        prices[l.itemId] = Number(l.unitPrice)
      }
      setSubmitting(true)
      const res = await purchaseOrdersApi.convertFromPr({
        purchaseRequestId: fromPrId,
        code,
        supplierId,
        warehouseId: warehouseId || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        unitPricesByItemId: prices,
      })
      setSubmitting(false)
      if (res.success && res.data) router.push(`/procurement/purchase-orders/${res.data.id}`)
      else setError(res.message ?? 'Convert failed')
      return
    }

    // Direct PO creation
    const cleanLines = lines
      .filter((l) => l.itemId && l.quantity && l.unitPrice)
      .map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      }))
    if (!cleanLines.length) {
      setError('Add at least one complete line')
      return
    }
    setSubmitting(true)
    const res = await purchaseOrdersApi.create({
      tenantId,
      code,
      supplierId,
      warehouseId: warehouseId || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      lines: cleanLines,
    })
    setSubmitting(false)
    if (res.success && res.data) router.push(`/procurement/purchase-orders/${res.data.id}`)
    else setError(res.message ?? 'Create failed')
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/procurement/purchase-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">
        {fromPrId ? 'Convert PR to PO' : 'New Purchase Order'}
      </h1>
      {pr && (
        <p className="mt-1 text-sm text-gray-500">
          Source PR: <span className="font-mono">{pr.code}</span> — items pre-filled, enter unit
          prices below.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-3xl space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">PO code *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Supplier *</label>
            <div className="mt-1">
              <SupplierPicker
                value={supplierId}
                onChange={(id) => setSupplierId(id)}
                placeholder="Pick a supplier"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Expected delivery</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">
              Delivery warehouse
            </label>
            <div className="mt-1">
              <WarehousePicker
                value={warehouseId}
                onChange={(id) => setWarehouseId(id)}
                placeholder="Pick a warehouse"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[13px] font-semibold text-gray-700">Line items</label>
            {!fromPrId && (
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </button>
            )}
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2"
              >
                {fromPrId ? (
                  <div className="col-span-5 truncate rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-[13px] text-gray-700">
                    {l.itemLabel || l.itemId.slice(0, 8)}
                  </div>
                ) : (
                  <div className="col-span-5">
                    <ItemPicker
                      value={l.itemId}
                      onChange={(id, opt) =>
                        setLine(i, {
                          itemId: id,
                          itemLabel: opt ? `${opt.secondary ?? ''} — ${opt.primary}` : '',
                        })
                      }
                      placeholder="Pick an item *"
                      compact
                    />
                  </div>
                )}
                <input
                  type="number"
                  step="any"
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                  readOnly={!!fromPrId}
                  placeholder="Qty *"
                  className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px]"
                />
                <input
                  type="number"
                  step="any"
                  value={l.unitPrice}
                  onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                  placeholder="Unit price *"
                  className="col-span-4 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px]"
                />
                {!fromPrId && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="col-span-1 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end text-sm">
            <span className="text-gray-500">Subtotal:</span>
            <span className="ml-2 text-lg font-semibold text-gray-900 tabular-nums">
              ₱{subtotal.toLocaleString()}
            </span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/procurement/purchase-orders"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : fromPrId ? 'Create PO from PR' : 'Create PO'}
          </button>
        </div>
      </form>
    </div>
  )
}
