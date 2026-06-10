'use client'

import { useRef } from 'react'
import {
  Smartphone,
  Scan,
  Loader2,
  X,
  ChevronRight,
  Wifi,
  WifiOff,
  Plus,
  Minus,
} from 'lucide-react'
import { useMobileCount } from '../_hooks/useMobileCount'
import type { SessionUser } from '@/src/libs/guards/permission'

export default function MobileCountInterface({ session: _ }: { session: SessionUser }) {
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const {
    sessions,
    isLoadingSessions,
    selectedSession,
    setSelectedSession,
    scanEntries,
    barcodeInput,
    setBarcodeInput,
    handleScan,
    updateQuantity,
    removeEntry,
    submitScans,
    isSubmitting,
    unsyncedCount,
  } = useMobileCount()

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleScan(barcodeInput)
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const totalCounted = scanEntries.reduce((sum, e) => sum + e.countedQty, 0)

  if (!selectedSession) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-900 text-white">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-5">
          <Smartphone className="h-6 w-6 text-prominent-orange-200" />
          <div>
            <h1 className="text-lg font-bold">Mobile Barcode Count</h1>
            <p className="text-sm text-zinc-400">Select a count session to begin scanning</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Scan className="mb-4 h-14 w-14 text-zinc-600" />
              <p className="text-lg font-semibold text-zinc-300">No Active Sessions</p>
              <p className="mt-2 text-sm text-zinc-500">
                No count sessions are in progress. Create and start one from Stock Counts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Active Sessions
              </p>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  className="flex w-full items-center justify-between rounded-2xl bg-zinc-800 px-5 py-4 text-left hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {session.warehouse?.name ?? 'Unknown Warehouse'}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-400">
                      {session.warehouse?.code ?? '—'} &bull;{' '}
                      {session.scheduledDate
                        ? new Date(session.scheduledDate).toLocaleDateString()
                        : 'No date'}
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-600">
                      #{session.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-zinc-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedSession(null)}
            className="rounded-xl p-2 hover:bg-zinc-800"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
          <div>
            <p className="font-semibold">{selectedSession.warehouse?.name ?? 'Count Session'}</p>
            <p className="text-xs text-zinc-500">#{selectedSession.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unsyncedCount > 0 ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
              <WifiOff className="h-3.5 w-3.5" />
              {unsyncedCount} unsynced
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-green-400">
              <Wifi className="h-3.5 w-3.5" />
              Synced
            </span>
          )}
        </div>
      </div>

      {/* Barcode scanner input */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleScan(barcodeInput)
                }
              }}
              placeholder="Scan barcode or enter SKU…"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-4 pl-10 pr-4 text-base font-mono text-white placeholder-zinc-500 outline-none focus:border-prominent-orange-400 focus:ring-1 focus:ring-prominent-orange-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-prominent-orange-700 px-5 py-4 text-sm font-semibold text-white hover:bg-prominent-orange-800 active:bg-prominent-orange-900"
          >
            Add
          </button>
        </form>
      </div>

      {/* Scan entries list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {scanEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Scan className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="text-zinc-400">Scan a barcode to start counting</p>
            <p className="mt-1 text-xs text-zinc-600">Items will appear here as you scan them</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scanEntries.map((entry) => (
              <div
                key={entry.itemId}
                className="flex items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-white">{entry.itemName}</p>
                  <p className="font-mono text-xs text-zinc-400">{entry.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateQuantity(entry.itemId, entry.countedQty - 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-700 text-white hover:bg-zinc-600 active:bg-zinc-500"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-xl font-bold tabular-nums text-white">
                    {entry.countedQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(entry.itemId, entry.countedQty + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-700 text-white hover:bg-zinc-600 active:bg-zinc-500"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.itemId)}
                    className="ml-1 rounded-lg p-1.5 text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — summary + submit */}
      {scanEntries.length > 0 && (
        <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-5">
          <div className="mb-4 flex items-center justify-between text-sm text-zinc-400">
            <span>
              {scanEntries.length} item type{scanEntries.length !== 1 ? 's' : ''}
            </span>
            <span>{totalCounted} total units counted</span>
          </div>
          <button
            type="button"
            onClick={submitScans}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-600 py-4 text-base font-bold text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting ? 'Submitting…' : 'Submit Count'}
          </button>
        </div>
      )}
    </div>
  )
}
