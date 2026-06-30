'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PauseCircle, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useParkedSales, useResumeParkedSale, useCancelParkedSale } from '../_hooks/usePos'
import type { ParkedSale } from '@/src/schema/pos'

import { PosDateTime } from '../_components/PosDate'

function itemCount(cartData: Record<string, unknown>): number {
  const lines = cartData?.lines
  if (!Array.isArray(lines)) return 0
  return lines.reduce((s: number, l: unknown) => {
    const line = l as Record<string, unknown>
    return s + (typeof line.quantity === 'number' ? line.quantity : 0)
  }, 0)
}

export default function ParkedSalesPage() {
  const router = useRouter()
  const { data, isLoading, isFetching, refetch } = useParkedSales()
  const resumeMutation = useResumeParkedSale()
  const cancelMutation = useCancelParkedSale()
  const [error, setError] = useState('')
  const [cancelTarget, setCancelTarget] = useState<ParkedSale | null>(null)

  const sales: ParkedSale[] = (data?.data ?? []).filter((s) => s.status === 'parked')

  async function handleResume(sale: ParkedSale) {
    setError('')
    const res = await resumeMutation.mutateAsync(sale.id)
    if (!res.success) {
      setError(res.error ?? 'Failed to resume sale')
      return
    }
    try {
      localStorage.setItem('pos_resumed_cart', JSON.stringify(sale.cartData))
    } catch {
      // localStorage full or unavailable — checkout will start with an empty cart
    }
    router.push('/pos/checkout')
  }

  async function handleCancel(sale: ParkedSale) {
    setError('')
    const res = await cancelMutation.mutateAsync(sale.id)
    if (!res.success) {
      setError(res.error ?? 'Failed to cancel sale')
      return
    }
    setCancelTarget(null)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Parked Sales</h1>
            <p className="mt-1 text-sm text-gray-500">
              Resume or cancel held carts from any session on this terminal.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-300">
              <PauseCircle size={48} strokeWidth={1} />
              <p className="text-sm font-medium text-gray-400">No parked sales</p>
              <p className="text-xs text-gray-400">Parked carts will appear here for resuming.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Label
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Terminal
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Parked
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                    Items
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{sale.label}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {sale.terminal?.name ?? sale.terminalId}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      <PosDateTime iso={sale.parkedAt} />
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">
                      {itemCount(sale.cartData)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleResume(sale)}
                          disabled={resumeMutation.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                        >
                          <RotateCcw size={11} />
                          Resume
                        </button>
                        <button
                          onClick={() => {
                            setError('')
                            setCancelTarget(sale)
                          }}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cancel confirm dialog */}
      {cancelTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setCancelTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <button
                onClick={() => setCancelTarget(null)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
              <h2 className="mb-2 text-lg font-bold text-gray-900">Cancel Parked Sale?</h2>
              <p className="mb-1 text-sm text-gray-600">
                &ldquo;{cancelTarget.label}&rdquo; will be permanently discarded.
              </p>
              <p className="mb-5 text-xs text-gray-400">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Keep
                </button>
                <button
                  onClick={() => handleCancel(cancelTarget)}
                  disabled={cancelMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Discard Sale'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
