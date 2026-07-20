'use client'

import { X, ClipboardList } from 'lucide-react'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
  converted: 'bg-purple-100 text-purple-700',
}

const APPROVAL_TIER_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
}

export function ViewPurchaseRequestModal({ open, onClose, pr }: Props) {
  if (!open || !pr) return null

  const estimatedTotal = pr.lines.reduce(
    (sum, line) => sum + line.quantity * (line.estimatedUnitPrice ?? 0),
    0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-prominent-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{pr.code}</h2>
                <span
                  className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[pr.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                >
                  {pr.status}
                </span>
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
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Branch</p>
              <p className="text-zinc-900">{pr.branch?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Created</p>
              <p className="text-zinc-900">{new Date(pr.createdAt).toLocaleDateString()}</p>
            </div>
            {pr.submittedAt && (
              <div>
                <p className="text-xs text-zinc-500">Submitted</p>
                <p className="text-zinc-900">{new Date(pr.submittedAt).toLocaleDateString()}</p>
              </div>
            )}
            {pr.approvedAt && (
              <div>
                <p className="text-xs text-zinc-500">Approved</p>
                <p className="text-zinc-900">{new Date(pr.approvedAt).toLocaleDateString()}</p>
              </div>
            )}
            {pr.convertedToPo && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-500">Converted to PO</p>
                <p className="font-medium text-purple-700">{pr.convertedToPo.code}</p>
              </div>
            )}
          </div>

          {pr.reason && (
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Reason</p>
              <p className="text-sm text-zinc-700">{pr.reason}</p>
            </div>
          )}

          {pr.notes && (
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Notes</p>
              <p className="text-sm text-zinc-700">{pr.notes}</p>
            </div>
          )}

          {/* Approval history */}
          {pr.approvals.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">Approval tiers</p>
              <div className="space-y-2">
                {pr.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-zinc-800">{approval.label}</span>
                      {approval.remarks && (
                        <p className="mt-0.5 text-xs text-zinc-500">{approval.remarks}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {approval.actedAt && (
                        <span className="text-xs text-zinc-400">
                          {new Date(approval.actedAt).toLocaleDateString()}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${APPROVAL_TIER_STYLES[approval.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {approval.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">Line items ({pr.lines.length})</p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Est. Unit Price
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Est. Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pr.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900">{line.item.name}</p>
                        <p className="text-xs text-zinc-400">SKU: {line.item.sku}</p>
                        {line.notes && <p className="mt-0.5 text-xs text-zinc-500">{line.notes}</p>}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700">{line.quantity}</td>
                      <td className="px-3 py-2 text-right text-zinc-700">
                        {line.estimatedUnitPrice != null
                          ? `₱${Number(line.estimatedUnitPrice).toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-900">
                        {line.estimatedUnitPrice != null
                          ? `₱${(line.quantity * line.estimatedUnitPrice).toLocaleString()}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {estimatedTotal > 0 && (
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50">
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-right text-xs font-medium text-zinc-500"
                      >
                        Estimated total
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-900">
                        ₱{estimatedTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
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
