'use client'

import { useEffect, useState } from 'react'
import { X, ShoppingCart, FileText } from 'lucide-react'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { getPurchaseOrderReceipts } from '../_actions/get-purchase-order-receipts'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pending' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
  partially_received: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
  fully_received: { bg: 'bg-green-100', text: 'text-green-700', label: 'Received' },
  closed: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Closed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-600', label: 'Cancelled' },
}

function fmtPHP(n: number) {
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800">{value}</p>
    </div>
  )
}

export function PoDetailModal({ po, onClose }: Props) {
  // Serial numbers only need fetching once a PO is closed — that's the point
  // at which receiving is done and there's a final list to show, per line,
  // instead of a partial/in-progress one.
  const [serialsByLine, setSerialsByLine] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!po || po.status !== 'closed') {
      setSerialsByLine({})
      return
    }
    let cancelled = false
    getPurchaseOrderReceipts(po.id).then((res) => {
      if (cancelled || !res.success) return
      const byLine: Record<string, string[]> = {}
      for (const receipt of res.data?.data ?? []) {
        for (const line of receipt.lines) {
          if (!line.purchaseOrderLineId || !line.serialNumbers?.length) continue
          byLine[line.purchaseOrderLineId] = [
            ...(byLine[line.purchaseOrderLineId] ?? []),
            ...line.serialNumbers,
          ]
        }
      }
      setSerialsByLine(byLine)
    })
    return () => {
      cancelled = true
    }
  }, [po?.id, po?.status])

  if (!po) return null

  const statusCfg = STATUS_CONFIG[po.status] ?? STATUS_CONFIG.draft
  const subtotal = po.subtotalAmount ?? po.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-prominent-purple-600" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-lg font-semibold text-zinc-900">{po.code}</h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
                >
                  {statusCfg.label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Created {fmtDate(po.createdAt)}
                {po.fromPr && ` · Converted from ${po.fromPr.code}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Supplier */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Supplier
            </p>
            <p className="mt-0.5 font-semibold text-zinc-900">{po.supplier.name}</p>
            {po.supplier.address && <p className="text-xs text-zinc-500">{po.supplier.address}</p>}
            {po.supplier.taxId && (
              <p className="font-mono text-xs text-zinc-400">TIN {po.supplier.taxId}</p>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Requested By" value={po.branch?.name ?? 'Tenant-wide'} />
            <div>
              <p className="text-xs font-medium text-zinc-400">Destination Warehouse</p>
              <p className="mt-0.5 text-sm text-zinc-800">{po.warehouse?.name ?? '—'}</p>
              {po.warehouse?.address && (
                <p className="mt-0.5 text-xs text-zinc-500">{po.warehouse.address}</p>
              )}
            </div>
            <InfoRow label="Order Date" value={fmtDate(po.orderDate)} />
            <InfoRow label="Expected Delivery" value={fmtDate(po.expectedDeliveryDate)} />
            <InfoRow
              label="Approved"
              value={po.approvedByName ? `${po.approvedByName} · ${fmtDate(po.approvedAt)}` : '—'}
            />
            {po.shippingAddress && (
              <div className="col-span-2">
                <InfoRow label="Shipping Address" value={po.shippingAddress} />
              </div>
            )}
            {po.deliveryInstructions && (
              <div className="col-span-2">
                <InfoRow label="Delivery Instructions" value={po.deliveryInstructions} />
              </div>
            )}
            {po.notes && (
              <div className="col-span-2">
                <InfoRow label="Notes" value={po.notes} />
              </div>
            )}
            {po.status === 'cancelled' && po.cancellationReason && (
              <div className="col-span-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                <p className="text-xs font-medium text-red-600">Cancellation Reason</p>
                <p className="mt-0.5 text-sm text-red-700">{po.cancellationReason}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              <FileText className="h-4 w-4 text-zinc-400" />
              Line Items
            </p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Received
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Unit Price
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {po.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-zinc-900">{line.item.name}</p>
                          {line.isFreebie && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              Freebie
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                        {line.description && (
                          <p className="mt-0.5 text-xs text-zinc-500">{line.description}</p>
                        )}
                        {line.srp != null && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            SRP {fmtPHP(Number(line.srp))}
                            {line.discounts && line.discounts.length > 0 && (
                              <>
                                {' · '}
                                {line.discounts
                                  .map((d) =>
                                    d.type === 'percentage' ? `${d.value}%` : fmtPHP(d.value)
                                  )
                                  .join(' → ')}{' '}
                                off
                                {line.discountedCost != null &&
                                  ` → ${fmtPHP(Number(line.discountedCost))}`}
                              </>
                            )}
                          </p>
                        )}
                        {(serialsByLine[line.id] ?? []).length > 0 && (
                          <div className="mt-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                              Serial Numbers ({serialsByLine[line.id].length})
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {serialsByLine[line.id].map((sn) => (
                                <span
                                  key={sn}
                                  className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
                                >
                                  {sn}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700">{line.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={
                            (line.receivedQuantity ?? 0) >= line.quantity
                              ? 'font-medium text-green-600'
                              : (line.receivedQuantity ?? 0) > 0
                                ? 'font-medium text-amber-600'
                                : 'text-zinc-400'
                          }
                        >
                          {line.receivedQuantity ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700">
                        {fmtPHP(line.unitPrice)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900">
                        {fmtPHP(line.lineTotal ?? line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="text-zinc-700">{fmtPHP(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-1.5 text-sm font-semibold">
                <span className="text-zinc-700">Total</span>
                <span className="text-zinc-900">{fmtPHP(Number(po.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
