'use client'

import { useState } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import type {
  BatchSummary,
  BatchStatus,
  UpdateBatchStatusFormValues,
} from '@/src/schema/inventory/batches'
import {
  BATCH_STATUS_LABELS,
  BATCH_STATUS_COLORS,
  getExpiryStatus,
  EXPIRY_STATUS_COLORS,
  EXPIRY_STATUS_LABELS,
} from '@/src/schema/inventory/batches'
import type { ApiResponse } from '@/src/libs/api/client'

type Props = {
  batch: BatchSummary | null
  onClose: () => void
  onUpdateStatus: (args: {
    id: string
    data: UpdateBatchStatusFormValues
  }) => Promise<ApiResponse<unknown>>
  onPlaceHold: (args: { id: string; reason: string }) => Promise<ApiResponse<unknown>>
  onReleaseHold: (args: { id: string; reason: string }) => Promise<ApiResponse<unknown>>
  isUpdatingStatus: boolean
  isPlacingHold: boolean
  isReleasingHold: boolean
}

export default function BatchDetailDrawer({
  batch,
  onClose,
  onUpdateStatus,
  onPlaceHold,
  onReleaseHold,
  isUpdatingStatus,
  isPlacingHold,
  isReleasingHold,
}: Props) {
  const [newStatus, setNewStatus] = useState<BatchStatus>('active')
  const [statusReason, setStatusReason] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [releaseReason, setReleaseReason] = useState('')
  const [tab, setTab] = useState<'details' | 'status'>('details')

  if (!batch) return null

  const expiryStatus = getExpiryStatus(batch.expiryDate)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md h-full overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Batch Details</h2>
            <p className="mt-0.5 font-mono text-sm text-zinc-500">{batch.batchNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-zinc-200 px-6">
          <div className="flex gap-4">
            {(['details', 'status'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-prominent-purple-700 text-prominent-purple-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                {t === 'details' ? 'Details' : 'Update Status'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {tab === 'details' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Item
                  </p>
                  <p className="mt-1 font-medium text-zinc-900">{batch.item?.name ?? '—'}</p>
                  {batch.item?.sku && (
                    <p className="font-mono text-xs text-zinc-400">{batch.item.sku}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Status
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BATCH_STATUS_COLORS[batch.status]}`}
                  >
                    {BATCH_STATUS_LABELS[batch.status]}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Manufacture Date
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">
                    {batch.manufactureDate
                      ? new Date(batch.manufactureDate).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Expiry Date
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm text-zinc-700">
                      {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                    </p>
                    {batch.expiryDate && (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_STATUS_COLORS[expiryStatus]}`}
                      >
                        {EXPIRY_STATUS_LABELS[expiryStatus]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {expiryStatus === 'expiring_soon' && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    This batch is expiring within 30 days. Prioritize for FEFO dispatch.
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Created
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>

              {batch.status !== 'quarantine' ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-700">Place Quality Hold</p>
                  <textarea
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    placeholder="Reason for hold (e.g. suspected contamination)…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    disabled={!holdReason.trim() || isPlacingHold}
                    onClick={() => onPlaceHold({ id: batch.id, reason: holdReason })}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {isPlacingHold && <Loader2 className="h-4 w-4 animate-spin" />}
                    Place Hold
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-700">Release Quality Hold</p>
                  <textarea
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    placeholder="Reason for release (e.g. tests came back clean)…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                  <button
                    type="button"
                    disabled={!releaseReason.trim() || isReleasingHold}
                    onClick={() => onReleaseHold({ id: batch.id, reason: releaseReason })}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isReleasingHold && <Loader2 className="h-4 w-4 animate-spin" />}
                    Release Hold
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'status' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BatchStatus)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
                >
                  {(['active', 'quarantine', 'expired', 'recalled'] as const).map((s) => (
                    <option key={s} value={s}>
                      {BATCH_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {newStatus === 'quarantine' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Required for quarantine status…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
                  />
                </div>
              )}
              <button
                type="button"
                disabled={isUpdatingStatus || (newStatus === 'quarantine' && !statusReason.trim())}
                onClick={() =>
                  onUpdateStatus({
                    id: batch.id,
                    data: { status: newStatus, reason: statusReason || undefined },
                  })
                }
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isUpdatingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUpdatingStatus ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
