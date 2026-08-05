'use client'

import { useState } from 'react'
import { X, KeyRound, ShieldCheck } from 'lucide-react'
import { validatePriceOverrideByPin } from '../../_actions/pos-actions'

type Props = {
  itemName: string
  /** Current resolved price, if any — shown as context, not editable directly. */
  currentPrice: number | null
  onClose: () => void
  onApprove: (result: { managerId: string; managerName: string; newPrice: number }) => void
}

/** PIN-gated manual price override — fills a gap when an item has no
 * matching price-list entry under the selected Price Use, or lets a manager
 * adjust an already-resolved price. Identifies the manager by PIN alone (no
 * User ID to look up or paste) — the backend matches the PIN against every
 * user who actually holds pos:transactions:price_override, same
 * McDonald's-style in-person pattern the discount override already uses. */
export default function PriceOverrideDialog({ itemName, currentPrice, onClose, onApprove }: Props) {
  const [pin, setPin] = useState('')
  const [newPrice, setNewPrice] = useState(currentPrice !== null ? String(currentPrice) : '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit() {
    setError('')
    if (!pin.trim()) {
      setError("Enter the manager's PIN.")
      return
    }
    const priceValue = Number(newPrice)
    if (!newPrice.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setError('Enter a valid price.')
      return
    }
    setPending(true)
    const res = await validatePriceOverrideByPin(pin.trim())
    setPending(false)
    if (!res.success || !res.data) {
      setError(res.error ?? 'Override failed')
      return
    }
    onApprove({
      managerId: res.data.managerId,
      managerName: res.data.managerName ?? 'Manager',
      newPrice: priceValue,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <KeyRound size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Price Override</h2>
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
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
              {currentPrice !== null && (
                <p className="mt-1 text-[10px] text-gray-400">
                  Currently resolved at ₱{currentPrice.toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Manager PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="input font-mono tracking-widest"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
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
              disabled={pending || !pin.trim()}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              {pending ? 'Verifying…' : 'Approve Override'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
