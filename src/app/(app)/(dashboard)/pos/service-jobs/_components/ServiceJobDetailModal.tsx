'use client'

import { useEffect, useState } from 'react'
import { X, Wrench, Loader2, PackageSearch } from 'lucide-react'
import type { ServiceDraft, RecordActualsFormValues } from '@/src/schema/pos/service-drafts'
import { SERVICE_DRAFT_STATUS_STYLES } from './status-styles'
import { customerDisplayName } from './service-draft-utils'

const LINE_SOURCE_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  purchase_order: 'Purchase Order',
}

function technicianDisplayName(
  technician: NonNullable<ServiceDraft['technician']> | null | undefined
): string {
  if (!technician) return '—'
  return (
    `${technician.firstName ?? ''} ${technician.lastName ?? ''}`.trim() || technician.email || '—'
  )
}

type Props = {
  open: boolean
  onClose: () => void
  draft: ServiceDraft | null
  isLoading?: boolean
  canEdit?: boolean
  canCancel?: boolean
  canSource?: boolean
  canInstall?: boolean
  canComplete?: boolean
  onEdit?: (draft: ServiceDraft) => void
  onCancelJob?: (draft: ServiceDraft) => void
  onSource?: (draft: ServiceDraft) => void
  onStartInstall?: (draft: ServiceDraft) => void
  onSaveActuals?: (id: string, data: RecordActualsFormValues) => Promise<unknown>
  onCompleteJob?: (id: string) => Promise<unknown>
  isCancelling?: boolean
  isRecordingActuals?: boolean
  isCompleting?: boolean
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
  canSource,
  canInstall,
  canComplete,
  onEdit,
  onCancelJob,
  onSource,
  onStartInstall,
  onSaveActuals,
  onCompleteJob,
  isCancelling,
  isRecordingActuals,
  isCompleting,
}: Props) {
  // Local edit buffer for actual-qty inputs while installing — keyed by
  // lineId, string-valued so an in-progress "1." doesn't get coerced away
  // mid-typing. Reset whenever a different draft opens.
  const [actualEdits, setActualEdits] = useState<Record<string, string>>({})

  useEffect(() => {
    if (draft?.status === 'installing') {
      setActualEdits(
        Object.fromEntries(
          draft.lines.map((line) => [line.id, line.actualQty != null ? String(line.actualQty) : ''])
        )
      )
    } else {
      setActualEdits({})
    }
    // Only re-sync when a different draft (or its status) loads, not on
    // every keystroke — this is a reset, not a controlled mirror.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.status])

  if (!open) return null

  const isTerminal = draft ? draft.status === 'completed' || draft.status === 'cancelled' : true
  const isEditingActuals = draft?.status === 'installing' && canInstall

  async function handleSaveActuals() {
    if (!draft) return
    const lines = Object.entries(actualEdits)
      .filter(([, value]) => value.trim() !== '')
      .map(([lineId, value]) => ({ lineId, actualQty: Number(value) }))
      .filter((l) => Number.isFinite(l.actualQty) && l.actualQty >= 0)
    if (!lines.length) return
    await onSaveActuals?.(draft.id, { lines })
  }

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
                {draft.technician && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Technician
                    </p>
                    <p className="mt-0.5 text-zinc-800">
                      {technicianDisplayName(draft.technician)}
                    </p>
                  </div>
                )}
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
                        {draft.status !== 'draft' && (
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Source
                          </th>
                        )}
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
                            {isEditingActuals ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={actualEdits[line.id] ?? ''}
                                onChange={(e) =>
                                  setActualEdits((prev) => ({
                                    ...prev,
                                    [line.id]: e.target.value,
                                  }))
                                }
                                placeholder="0"
                                className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-right text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            ) : (
                              (line.actualQty ?? '—')
                            )}
                          </td>
                          {draft.status !== 'draft' && (
                            <td className="px-3 py-2 text-left text-zinc-600">
                              {line.source ? LINE_SOURCE_LABELS[line.source] : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Purchase Requests (Closing Gap 3) */}
              {!!draft.sourcingPurchaseRequests?.length && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Purchase Requests Raised
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {draft.sourcingPurchaseRequests.map((pr) => (
                      <span
                        key={pr.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {pr.code}
                        <span className="capitalize text-zinc-400">({pr.status})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Edit
                </button>
              )}
              {canSource && draft.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => onSource?.(draft)}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
                >
                  <PackageSearch className="h-4 w-4" />
                  Check Stock &amp; Source
                </button>
              )}
              {canInstall && draft.status === 'sourcing' && (
                <button
                  type="button"
                  onClick={() => onStartInstall?.(draft)}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
                >
                  <Wrench className="h-4 w-4" />
                  Start Install
                </button>
              )}
              {isEditingActuals && (
                <button
                  type="button"
                  onClick={handleSaveActuals}
                  disabled={isRecordingActuals}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {isRecordingActuals ? 'Saving…' : 'Save Actuals'}
                </button>
              )}
              {canComplete && draft.status === 'installing' && (
                <button
                  type="button"
                  onClick={() => onCompleteJob?.(draft.id)}
                  disabled={isCompleting}
                  className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                >
                  {isCompleting ? 'Completing…' : 'Complete Job'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
