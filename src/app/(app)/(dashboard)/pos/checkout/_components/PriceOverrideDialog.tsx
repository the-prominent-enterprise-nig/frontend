'use client'

import { useState } from 'react'
import { X, Check, Tag } from 'lucide-react'

type Props = {
  itemName: string
  /** The price the line is on now — the resolved one, or the one already typed
   * over it. Shown as context and used to prefill the field. */
  currentPrice: number | null
  /** The price-list price the line started from, when it had one — so a
   * cashier changing an override still sees what list price it is measured
   * against. */
  listPrice: number | null
  onClose: () => void
  onApply: (newPrice: number) => void
}

/** Manual price on one cart line — fills a gap when an item has no matching
 * price-list entry under the selected Price Use, or replaces a resolved price.
 * No manager and no PIN: any cashier can apply it. What it needs is a reason
 * and a note, asked once for the whole sale in the order summary; management
 * looks at every override in the end-of-day review (Scenario 71). */
export default function PriceOverrideDialog({
  itemName,
  currentPrice,
  listPrice,
  onClose,
  onApply,
}: Props) {
  const [newPrice, setNewPrice] = useState(currentPrice !== null ? String(currentPrice) : '')
  const [error, setError] = useState('')

  function handleSubmit() {
    setError('')
    const priceValue = Number(newPrice)
    if (!newPrice.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setError('Enter a valid price.')
      return
    }
    onApply(priceValue)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Tag size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-prominent-purple-900">Price Override</h2>
              <p className="text-xs text-gray-500">{itemName}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                New Unit Price (₱)
              </label>
              <input
                autoFocus
                type="number"
                min={0}
                step="0.01"
                className="input font-mono text-sm"
                placeholder="0.00"
                aria-label="New unit price"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              {listPrice !== null && (
                <p className="mt-1 text-[11px] text-gray-500">
                  List price ₱
                  {listPrice.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              {currentPrice !== null && currentPrice !== listPrice && (
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Currently ₱
                  {currentPrice.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500">
              No approval is needed. Pick a reason and add a note in the order summary — management
              reviews every override at the end of the day.
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              <Check size={14} />
              Apply Override
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
