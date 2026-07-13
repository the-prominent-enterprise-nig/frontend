'use client'

import { useEffect, useState } from 'react'
import {
  X,
  Loader2,
  PackageCheck,
  AlertTriangle,
  Hash,
  Warehouse,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { getPurchaseOrderReceipts, type PoReceipt } from '../_actions/get-purchase-order-receipts'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
}

// ─── Variance badge ───────────────────────────────────────────────────────────

function QtyVarianceBadge({ ordered, received }: { ordered: number; received: number }) {
  const variance = received - ordered
  if (variance === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Exact
      </span>
    )
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        variance < 0 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
      }`}
    >
      {variance > 0 ? `+${variance}` : variance}
    </span>
  )
}

// ─── Overall progress bar ─────────────────────────────────────────────────────

function OverallProgress({
  totalOrdered,
  totalReceived,
}: {
  totalOrdered: number
  totalReceived: number
}) {
  const pct = totalOrdered > 0 ? Math.min((totalReceived / totalOrdered) * 100, 100) : 0
  const barColor = pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-zinc-200'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          <span className="font-semibold text-zinc-800">{totalReceived}</span> of{' '}
          <span className="font-semibold text-zinc-800">{totalOrdered}</span> units received
        </span>
        <span className="font-semibold text-zinc-700">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded bg-zinc-200" />
          <div className="h-3 w-48 rounded bg-zinc-200" />
        </div>
      </div>
      <div className="divide-y divide-zinc-50">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-zinc-200" />
              <div className="h-3 w-24 rounded bg-zinc-200" />
            </div>
            <div className="h-3.5 w-16 rounded bg-zinc-200" />
            <div className="h-3.5 w-16 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── GRN card ─────────────────────────────────────────────────────────────────

function GrnCard({ grn, index }: { grn: PoReceipt; index: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasHold = grn.lines.some((l) => l.qualityHold)
  const totalReceived = grn.lines.reduce((s, l) => s + l.quantityReceived, 0)
  const totalOrdered = grn.lines.reduce((s, l) => s + l.qtyOrdered, 0)

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-left hover:bg-zinc-100/70 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Delivery number */}
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-prominent-purple-100 text-xs font-bold text-prominent-purple-700">
            {index + 1}
          </span>
          <div>
            <p className="font-mono text-sm font-semibold text-zinc-900">{grn.code}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
              {grn.warehouse && (
                <span className="flex items-center gap-1">
                  <Warehouse className="h-3 w-3" />
                  {grn.warehouse.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {new Date(grn.receivedAt).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {grn.lines.length} line{grn.lines.length !== 1 ? 's' : ''} · {totalReceived} units
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasHold && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              QC Hold
            </span>
          )}
          {totalReceived < totalOrdered ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              Short
            </span>
          ) : totalReceived > totalOrdered ? (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">
              Over
            </span>
          ) : (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
              Complete
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Lines table */}
      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Item</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-400">Ordered</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-400">
                Received
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-400">
                Variance
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">
                Batch / Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {grn.lines.map((line) => (
              <tr key={line.id} className={line.qualityHold ? 'bg-amber-50/60' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-800">{line.item?.name ?? line.itemId}</p>
                  {line.item?.sku && (
                    <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                  )}
                  {line.qualityHold && (
                    <p className="mt-0.5 text-xs font-medium text-amber-600">QC Hold</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-zinc-500">{line.qtyOrdered}</td>
                <td className="px-4 py-3 text-center font-semibold text-zinc-900">
                  {line.quantityReceived}
                </td>
                <td className="px-4 py-3 text-center">
                  <QtyVarianceBadge ordered={line.qtyOrdered} received={line.quantityReceived} />
                </td>
                <td className="px-4 py-3">
                  {line.batchNumber ? (
                    <p className="font-mono text-xs text-zinc-600">{line.batchNumber}</p>
                  ) : null}
                  {line.expiryDate ? (
                    <p className="text-xs text-zinc-400">
                      Exp:{' '}
                      {new Date(line.expiryDate).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  ) : null}
                  {(line.serialNumbers ?? []).length > 0 && (
                    <p className="text-xs text-zinc-400">{(line.serialNumbers ?? []).length} S/N</p>
                  )}
                  {!line.batchNumber && !line.expiryDate && !(line.serialNumbers ?? []).length && (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {grn.notes && expanded && (
        <p className="border-t border-zinc-100 px-4 py-2.5 text-xs italic text-zinc-500">
          {grn.notes}
        </p>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function PoReceiptsPanel({ po, onClose }: Props) {
  const [receipts, setReceipts] = useState<PoReceipt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!po) return
    setIsLoading(true)
    setError(null)
    getPurchaseOrderReceipts(po.id)
      .then((res) => {
        if (res.success) setReceipts(res.data?.data ?? [])
        else setError(res.message ?? 'Failed to load receipts')
      })
      .finally(() => setIsLoading(false))
  }, [po])

  if (!po) return null

  const totalOrdered = po.lines.reduce((s, l) => s + Number(l.quantity), 0)
  const totalReceived = receipts.flatMap((r) => r.lines).reduce((s, l) => s + l.quantityReceived, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Delivery Receipts</h2>
            <p className="mt-0.5 font-mono text-sm font-medium text-prominent-purple-700">
              {po.code}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">{po.supplier.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary strip */}
        {!isLoading && !error && receipts.length > 0 && (
          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
            <div className="mb-3 flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs text-zinc-400">Deliveries</p>
                <p className="font-semibold text-zinc-900">{receipts.length}</p>
              </div>
              <div className="h-6 w-px bg-zinc-200" />
              <div>
                <p className="text-xs text-zinc-400">Lines received</p>
                <p className="font-semibold text-zinc-900">
                  {receipts.flatMap((r) => r.lines).length}
                </p>
              </div>
              <div className="h-6 w-px bg-zinc-200" />
              <div>
                <p className="text-xs text-zinc-400">Total received</p>
                <p className="font-semibold text-zinc-900">{totalReceived} units</p>
              </div>
            </div>
            <OverallProgress totalOrdered={totalOrdered} totalReceived={totalReceived} />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                <PackageCheck className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-700">No deliveries yet</p>
              <p className="mt-1 max-w-xs text-xs text-zinc-400">
                Goods receipts will appear here once stock is received against this purchase order.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {receipts.map((grn, i) => (
                <GrnCard key={grn.id} grn={grn} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
