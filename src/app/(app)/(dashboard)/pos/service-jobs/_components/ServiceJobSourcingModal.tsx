'use client'

import { X, PackageSearch, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useServiceDraftStockCheck } from '../_hooks/useServiceDrafts'

type Props = {
  open: boolean
  onClose: () => void
  draftId: string | null
  draftTitle?: string
  onConfirm: (id: string) => Promise<unknown>
  isConfirming?: boolean
}

// Preview-then-confirm for Closing Gap 3: shows the per-line stock shortfall
// before committing, then POSTs /:id/source (raises a PR for any shortfall,
// moves the draft to sourcing) only once the user explicitly confirms.
export function ServiceJobSourcingModal({
  open,
  onClose,
  draftId,
  draftTitle,
  onConfirm,
  isConfirming,
}: Props) {
  const { stockCheck, isLoading } = useServiceDraftStockCheck(open ? draftId : null)

  if (!open) return null

  async function handleConfirm() {
    if (!draftId) return
    await onConfirm(draftId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-prominent-purple-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Check Stock &amp; Source</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          {draftTitle && <p className="mb-3 text-sm text-zinc-500">{draftTitle}</p>}

          {isLoading || !stockCheck ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Estimated
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Available
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Shortfall
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {stockCheck.lines.map((line) => (
                      <tr key={line.lineId}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-zinc-900">{line.name}</span>
                          <span className="ml-1.5 font-mono text-xs text-zinc-400">{line.sku}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-700">{line.estimatedQty}</td>
                        <td className="px-3 py-2 text-right text-zinc-700">{line.availableQty}</td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            line.shortfallQty > 0 ? 'text-amber-600' : 'text-zinc-400'
                          }`}
                        >
                          {line.shortfallQty > 0 ? line.shortfallQty : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  stockCheck.hasShortfall
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-green-200 bg-green-50 text-green-800'
                }`}
              >
                {stockCheck.hasShortfall ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                )}
                <p>
                  {stockCheck.hasShortfall
                    ? 'A Purchase Request will be raised for the shortfall line(s) above. The job moves to Sourcing.'
                    : 'All materials are available in stock. The job moves to Sourcing — no Purchase Request is needed.'}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !stockCheck || isConfirming}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            {isConfirming ? 'Confirming…' : 'Confirm & Source'}
          </button>
        </div>
      </div>
    </div>
  )
}
