'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { goodsReceiptsApi, purchaseOrdersApi } from '@/src/libs/api/procurement'
import { WarehousePicker } from '@/src/components/procurement/EntityPicker'
import type { PurchaseOrder } from '@/src/schema/procurement/types'

type LineDraft = {
  poLineId: string
  itemLabel: string
  ordered: number
  alreadyReceived: number
  receiveNow: string
  batchNumber: string
  expiryDate: string
  qualityHold: boolean
}

export default function ReceiveGoodsForm({
  poId,
  tenantId,
  currentUserId,
}: {
  poId: string
  tenantId: string
  currentUserId: string
}) {
  const router = useRouter()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [code, setCode] = useState(
    `GR-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`
  )
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    purchaseOrdersApi.get(poId).then((res) => {
      if (res.success && res.data) {
        setPo(res.data)
        setWarehouseId(res.data.warehouseId ?? '')
        setLines(
          res.data.lines?.map((l) => {
            const ordered = Number(l.quantity)
            const received = Number(l.receivedQuantity)
            return {
              poLineId: l.id,
              itemLabel: l.item ? `${l.item.sku} — ${l.item.name}` : l.itemId,
              ordered,
              alreadyReceived: received,
              receiveNow: String(ordered - received),
              batchNumber: '',
              expiryDate: '',
              qualityHold: false,
            }
          }) ?? []
        )
      } else setError(res.message ?? 'PO not found')
      setLoading(false)
    })
  }, [poId])

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!warehouseId) {
      setError('Warehouse UUID is required')
      return
    }

    const payloadLines = lines
      .filter((l) => Number(l.receiveNow) > 0)
      .map((l) => ({
        purchaseOrderLineId: l.poLineId,
        quantityReceived: Number(l.receiveNow),
        batchNumber: l.batchNumber || undefined,
        expiryDate: l.expiryDate || undefined,
        qualityHold: l.qualityHold,
      }))

    if (!payloadLines.length) {
      setError('Receive at least one line with quantity > 0')
      return
    }

    setSubmitting(true)
    const res = await goodsReceiptsApi.create({
      tenantId,
      code,
      purchaseOrderId: poId,
      warehouseId,
      receivedById: currentUserId,
      notes: notes || undefined,
      lines: payloadLines,
    })
    setSubmitting(false)
    if (res.success) {
      router.push(`/procurement/purchase-orders/${poId}`)
    } else {
      setError(res.message ?? 'Receive failed')
    }
  }

  if (loading) return <div className="px-6 py-8 text-gray-400">Loading PO…</div>
  if (error || !po) return <div className="px-6 py-8 text-red-600">{error ?? 'Not found'}</div>

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={`/procurement/purchase-orders/${poId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to PO
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">Receive against {po.code}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Quantities default to the remaining outstanding amount. Receipt updates inventory
        immediately unless you flag a line for quality hold.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Receipt code *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Warehouse *</label>
            <div className="mt-1">
              <WarehousePicker
                value={warehouseId}
                onChange={(id) => setWarehouseId(id)}
                placeholder="Pick the receiving warehouse"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Ordered</th>
                <th className="px-3 py-2 text-right">Already received</th>
                <th className="px-3 py-2 text-right">Receive now</th>
                <th className="px-3 py-2">Batch #</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2 text-center">QA hold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {lines.map((l, i) => (
                <tr key={l.poLineId}>
                  <td className="px-3 py-2 font-medium">{l.itemLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.ordered.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {l.alreadyReceived.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={l.ordered - l.alreadyReceived}
                      value={l.receiveNow}
                      onChange={(e) => setLine(i, { receiveNow: e.target.value })}
                      className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-[13px] tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={l.batchNumber}
                      onChange={(e) => setLine(i, { batchNumber: e.target.value })}
                      placeholder="—"
                      className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[13px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={l.expiryDate}
                      onChange={(e) => setLine(i, { expiryDate: e.target.value })}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[13px]"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={l.qualityHold}
                      onChange={(e) => setLine(i, { qualityHold: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/procurement/purchase-orders/${poId}`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Receiving…' : 'Confirm receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
