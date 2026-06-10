'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, PackageCheck, Send, XCircle } from 'lucide-react'
import { purchaseOrdersApi } from '@/src/libs/api/procurement'
import type { PurchaseOrder } from '@/src/schema/procurement/types'

export default function PurchaseOrderDetail({
  id,
  canSend,
  canClose,
  canCancel,
  canReceive,
}: {
  id: string
  canSend: boolean
  canClose: boolean
  canCancel: boolean
  canReceive: boolean
}) {
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await purchaseOrdersApi.get(id)
    if (res.success && res.data) setPo(res.data)
    else setError(res.message ?? 'Not found')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  async function send() {
    await purchaseOrdersApi.send(id)
    load()
  }
  async function close() {
    if (!confirm('Close this PO?')) return
    await purchaseOrdersApi.close(id)
    load()
  }
  async function cancel() {
    if (!confirm('Cancel this PO?')) return
    await purchaseOrdersApi.cancel(id)
    load()
  }

  if (loading) return <div className="px-6 py-8 text-gray-400">Loading…</div>
  if (error || !po) return <div className="px-6 py-8 text-red-600">{error ?? 'Not found'}</div>

  const canDoReceive = canReceive && (po.status === 'sent' || po.status === 'partially_received')

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/procurement/purchase-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{po.code}</h1>
          <div className="mt-1 text-sm text-gray-500">
            Supplier: {po.supplier?.name ?? po.supplierId.slice(0, 8)} · Status:{' '}
            <span className="font-medium">{po.status.replace('_', ' ')}</span>
            {po.fromPr && ` · From PR ${po.fromPr.code}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po.status === 'draft' && canSend && (
            <button
              onClick={send}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Send to supplier
            </button>
          )}
          {canDoReceive && (
            <Link
              href={`/procurement/goods-receiving/new?poId=${po.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700"
            >
              <PackageCheck className="h-4 w-4" />
              Receive goods <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {po.status === 'fully_received' && canClose && (
            <button
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close PO
            </button>
          )}
          {!['closed', 'cancelled', 'fully_received'].includes(po.status) && canCancel && (
            <button
              onClick={cancel}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Order date" value={new Date(po.orderDate).toLocaleDateString()} />
        <Stat
          label="Expected delivery"
          value={
            po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'
          }
        />
        <Stat label="Currency" value={po.currency} />
        <Stat label="Total" value={`₱${Number(po.totalAmount).toLocaleString()}`} accent />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="px-4 py-3 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {po.lines?.map((l) => {
              const ordered = Number(l.quantity)
              const received = Number(l.receivedQuantity)
              const remaining = ordered - received
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium">{l.item?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-500">
                    {l.item?.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{ordered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        received === ordered
                          ? 'text-emerald-700 font-medium'
                          : received > 0
                            ? 'text-amber-700 font-medium'
                            : 'text-gray-500'
                      }
                    >
                      {received.toLocaleString()}
                    </span>
                    {remaining > 0 && (
                      <span className="ml-1 text-[11px] text-gray-400">({remaining} left)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ₱{Number(l.unitPrice).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    ₱{Number(l.lineTotal).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          accent ? 'text-prominent-orange-700' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
