'use client'

import { X, Wrench, Loader2 } from 'lucide-react'
import type { ServiceDraft } from '@/src/schema/pos/service-drafts'
import { SERVICE_DRAFT_STATUS_STYLES } from './status-styles'
import { customerDisplayName } from './service-draft-utils'

type Props = {
  open: boolean
  onClose: () => void
  draft: ServiceDraft | null
  isLoading?: boolean
  canEdit?: boolean
  canCancel?: boolean
  onEdit?: (draft: ServiceDraft) => void
  onCancelJob?: (draft: ServiceDraft) => void
  isCancelling?: boolean
}

// Mirrors ViewPurchaseRequestModal's structure — full read-only detail plus
// terminal-action buttons gated on status.
export function ServiceJobDetailModal({
  open,
  onClose,
  draft,
  isLoading,
  canEdit,
  canCancel,
  onEdit,
  onCancelJob,
  isCancelling,
}: Props) {
  if (!open) return null

  const isTerminal = draft ? draft.status === 'completed' || draft.status === 'cancelled' : true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-prominent-purple-600" />
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {draft?.title ?? 'Service Job'}
                </h2>
                {draft && (
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SERVICE_DRAFT_STATUS_STYLES[draft.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {draft.status}
                  </span>
                )}
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

        {isLoading || !draft ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Customer
                  </p>
                  <p className="mt-0.5 text-zinc-800">{customerDisplayName(draft.customer)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Branch
                  </p>
                  <p className="mt-0.5 text-zinc-800">{draft.branch?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Created
                  </p>
                  <p className="mt-0.5 text-zinc-800">
                    {new Date(draft.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Lines</p>
                  <p className="mt-0.5 text-zinc-800">{draft.lines.length}</p>
                </div>
              </div>

              {/* Notes */}
              {draft.notes && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Notes
                  </p>
                  <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700">
                    {draft.notes}
                  </p>
                </div>
              )}

              {/* Lines */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Estimated Materials
                </p>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Item
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Estimated Qty
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Actual Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {draft.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-zinc-900">{line.item.name}</span>
                            <span className="ml-1.5 font-mono text-xs text-zinc-400">
                              {line.item.sku}
                            </span>
                            {line.notes && (
                              <p className="mt-0.5 text-xs text-zinc-400">{line.notes}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-700">
                            {line.estimatedQty}
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-400">
                            {line.actualQty ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              {canCancel && !isTerminal && (
                <button
                  type="button"
                  onClick={() => onCancelJob?.(draft)}
                  disabled={isCancelling}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel Job'}
                </button>
              )}
              {canEdit && draft.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => onEdit?.(draft)}
                  className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
                >
                  Edit
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
