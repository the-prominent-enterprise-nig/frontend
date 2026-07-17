'use client'

import { X, ShoppingCart, FileText } from 'lucide-react'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft' },
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
            <InfoRow label="Branch" value={po.branch?.name ?? 'Tenant-wide'} />
            <InfoRow label="Warehouse" value={po.warehouse?.name ?? '—'} />
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
                        <p className="font-medium text-zinc-900">{line.item.name}</p>
                        <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                        {line.description && (
                          <p className="mt-0.5 text-xs text-zinc-500">{line.description}</p>
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
