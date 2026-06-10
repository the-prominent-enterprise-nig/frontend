'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, ExternalLink, Receipt, ImageOff, Trash2 } from 'lucide-react'
import { REASON_CODE_LABELS, WriteOffSummary } from '@/src/schema/inventory/write-offs'
import {
  listWriteOffPhotos,
  removeWriteOffPhoto,
  type WriteOffPhoto,
} from '../_actions/write-off-photos'
import { showToast } from '@/src/components/ui/toast'

type Props = {
  isOpen: boolean
  writeOff: WriteOffSummary | null
  isLoading: boolean
  onClose: () => void
}

function photoUrl(fileId: string) {
  return `/api/files/${fileId}/download`
}

function PhotoThumbnail({
  photo,
  onRemove,
  isRemoving,
}: {
  photo: WriteOffPhoto
  onRemove: () => void
  isRemoving: boolean
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      {imgError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <ImageOff className="h-5 w-5 text-zinc-300" />
          <span className="px-1 text-center text-[9px] text-zinc-400 leading-tight">
            {photo.file.originalName}
          </span>
        </div>
      ) : (
        <img
          src={photoUrl(photo.file.id)}
          alt={photo.file.originalName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          className="rounded-lg bg-red-600 p-1.5 text-white shadow hover:bg-red-700 disabled:opacity-50"
          aria-label="Remove photo"
        >
          {isRemoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

export default function WriteOffDetailModal({ isOpen, writeOff, isLoading, onClose }: Props) {
  const [photos, setPhotos] = useState<WriteOffPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !writeOff?.id) {
      setPhotos([])
      return
    }
    setIsLoadingPhotos(true)
    listWriteOffPhotos(writeOff.id).then((res) => {
      setPhotos(res.success && res.data ? res.data : [])
      setIsLoadingPhotos(false)
    })
  }, [writeOff?.id, isOpen])

  async function handleRemovePhoto(photo: WriteOffPhoto) {
    if (!writeOff?.id) return
    setRemovingId(photo.id)
    const result = await removeWriteOffPhoto(writeOff.id, photo.id)
    setRemovingId(null)
    if (result.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      showToast({ title: 'Photo removed', status: 'success' })
    } else {
      showToast({ title: 'Failed to remove photo', description: result.message, status: 'error' })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Write-off Detail</h2>
            {writeOff && (
              <p className="mt-0.5 font-mono text-xs text-zinc-400">
                #{writeOff.id.slice(0, 8).toUpperCase()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : writeOff ? (
            <div className="space-y-4">
              {/* Item + Warehouse */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Item</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                    {writeOff.item?.name ?? '—'}
                  </p>
                  {writeOff.item?.sku && (
                    <p className="font-mono text-xs text-zinc-400">{writeOff.item.sku}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Warehouse
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                    {writeOff.warehouse?.name ?? '—'}
                  </p>
                  {writeOff.warehouse?.code && (
                    <p className="font-mono text-xs text-zinc-400">{writeOff.warehouse.code}</p>
                  )}
                </div>
              </div>

              {/* Quantity + Reason */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Quantity Written Off
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">{writeOff.quantity}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reason
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {REASON_CODE_LABELS[writeOff.reasonCode]}
                  </span>
                </div>
              </div>

              {/* Date + Created By */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Write-off Date
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-700">
                    {writeOff.writeOffDate
                      ? new Date(writeOff.writeOffDate).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
                {writeOff.createdBy && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Recorded By
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-700">{writeOff.createdBy.name}</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {writeOff.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Supporting Note
                  </p>
                  <p className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {writeOff.notes}
                  </p>
                </div>
              )}

              {/* Photo Attachments */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Photo Evidence
                </p>

                {isLoadingPhotos ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    <span className="text-xs text-zinc-400">Loading photos…</span>
                  </div>
                ) : photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <PhotoThumbnail
                        key={photo.id}
                        photo={photo}
                        onRemove={() => handleRemovePhoto(photo)}
                        isRemoving={removingId === photo.id}
                      />
                    ))}
                  </div>
                ) : writeOff.photoUrl ? (
                  /* Legacy single-URL records */
                  <a
                    href={writeOff.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-prominent-purple-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View attached photo
                  </a>
                ) : (
                  <p className="text-xs text-zinc-400">No photos attached</p>
                )}
              </div>

              {/* Accounting Entry */}
              <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <div>
                  <p className="text-xs font-medium text-zinc-600">Accounting Entry</p>
                  {writeOff.accountingEntry ? (
                    <div className="mt-0.5 space-y-0.5">
                      {writeOff.accountingEntry.referenceNumber && (
                        <p className="font-mono text-xs text-zinc-500">
                          Ref: {writeOff.accountingEntry.referenceNumber}
                        </p>
                      )}
                      {writeOff.accountingEntry.accountName && (
                        <p className="text-xs text-zinc-500">
                          Account: {writeOff.accountingEntry.accountName}
                        </p>
                      )}
                      {writeOff.accountingEntry.amount != null && (
                        <p className="text-xs font-semibold text-red-600">
                          Loss:{' '}
                          {writeOff.accountingEntry.amount.toLocaleString('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">Posted to Inventory Loss account</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-400">No data available.</p>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-6 py-4">
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
