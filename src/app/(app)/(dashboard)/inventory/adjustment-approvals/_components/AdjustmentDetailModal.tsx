'use client'

import { X } from 'lucide-react'
import {
  ADJUSTMENT_STATUS_LABELS,
  type AdjustmentStatus,
  type AdjustmentSummary,
} from '@/src/schema/inventory/adjustments'

const STATUS_COLORS: Record<AdjustmentStatus, string> = {
  submitted: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  investigating: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

function formatDateTime(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdjustmentDetailModal({
  adjustment,
  onClose,
}: {
  adjustment: AdjustmentSummary
  onClose: () => void
}) {
  const steps = [
    { label: 'Submitted', at: formatDateTime(adjustment.createdAt) },
    {
      label: 'Confirmed',
      by: adjustment.confirmedByName,
      at: formatDateTime(adjustment.confirmedAt),
    },
    {
      label: 'Investigating',
      by: adjustment.investigatingByName,
      at: formatDateTime(adjustment.investigatingAt),
    },
    {
      label: adjustment.status === 'rejected' ? 'Rejected' : 'Decided',
      by: adjustment.decidedByName,
      at: formatDateTime(adjustment.decidedAt),
      reason: adjustment.decisionReason,
    },
  ].filter((s) => s.at)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Adjustment #{adjustment.id.slice(0, 8).toUpperCase()}
            </h2>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[adjustment.status]}`}
            >
              {ADJUSTMENT_STATUS_LABELS[adjustment.status]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Warehouse</p>
              <p className="mt-0.5 text-sm text-zinc-900">{adjustment.warehouse?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Reason Code
              </p>
              <p className="mt-0.5 text-sm text-zinc-900">{adjustment.reasonCode}</p>
            </div>
          </div>

          {adjustment.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Notes</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">{adjustment.notes}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Lines ({adjustment.lines.length})
            </p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Expected</th>
                    <th className="px-3 py-2 text-right">Actual</th>
                    <th className="px-3 py-2 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {adjustment.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900">{line.item?.name ?? '—'}</p>
                        <p className="font-mono text-xs text-zinc-400">{line.item?.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{line.expectedQty}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{line.actualQty}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {line.actualQty - line.expectedQty > 0 ? '+' : ''}
                        {line.actualQty - line.expectedQty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {adjustment.status === 'approved' &&
              adjustment.lines.some((l) => l.beforeQty != null && l.afterQty != null) && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    System On-Hand at Posting
                  </p>
                  <div className="overflow-hidden rounded-lg border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-right">Before</th>
                          <th className="px-3 py-2 text-right">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {adjustment.lines
                          .filter((l) => l.beforeQty != null && l.afterQty != null)
                          .map((line) => (
                            <tr key={line.id}>
                              <td className="px-3 py-2">
                                <p className="font-medium text-zinc-900">
                                  {line.item?.name ?? '—'}
                                </p>
                                <p className="font-mono text-xs text-zinc-400">{line.item?.sku}</p>
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs">
                                {line.beforeQty}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs">
                                {line.afterQty}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Audit Trail
            </p>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-prominent-purple-500" />
                  <div>
                    <p className="text-zinc-900">
                      <span className="font-medium">{step.label}</span>
                      {step.by && <> by {step.by}</>}
                    </p>
                    <p className="text-xs text-zinc-400">{step.at}</p>
                    {step.reason && (
                      <p className="mt-0.5 text-xs text-zinc-600">Reason: {step.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
