'use client'

import { AlertTriangle, X, Loader2, Trash2 } from 'lucide-react'
import type { PriceList } from '@/src/schema/inventory/price-lists'

type Props = {
  open: boolean
  onClose: () => void
  priceList: PriceList | null
  onDelete: (id: string) => Promise<void>
  isDeleting?: boolean
}

export function DeletePriceListModal({ open, onClose, priceList, onDelete, isDeleting }: Props) {
  if (!open || !priceList) return null

  async function handleConfirm() {
    if (!priceList) return
    await onDelete(priceList.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Delete Price List</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">{priceList.name}</p>
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              {priceList.status === 'active'
                ? 'This list is currently active — deleting it stops it from applying at checkout immediately. '
                : ''}
              There&apos;s no undo for this — but you can create a New Version from it later if you
              need this pricing again.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
