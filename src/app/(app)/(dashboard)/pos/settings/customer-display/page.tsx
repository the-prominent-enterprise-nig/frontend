'use client'

import { useState } from 'react'
import { useSessionDisplay } from '../../_hooks/usePos'
import { Monitor, ShoppingCart, RefreshCw } from 'lucide-react'

function formatCurrency(n: number | string | undefined | null) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number(n ?? 0)
  )
}

export default function CustomerDisplayPage() {
  const [sessionId, setSessionId] = useState('')
  const [activeSessionId, setActiveSessionId] = useState('')

  const { data, isLoading, isFetching } = useSessionDisplay(activeSessionId)
  const display = data?.data

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Display</h1>
            <p className="mt-1 text-sm text-gray-500">Real-time order summary for customers.</p>
          </div>
          {activeSessionId && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Live (3s)
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Session ID</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Paste session ID…"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
            <button
              onClick={() => setActiveSessionId(sessionId.trim())}
              disabled={!sessionId.trim()}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              Connect
            </button>
            {activeSessionId && (
              <button
                onClick={() => {
                  setActiveSessionId('')
                  setSessionId('')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {!activeSessionId ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white py-20 text-gray-400">
            <Monitor size={48} />
            <p className="text-sm">Enter a session ID above to connect.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
            <RefreshCw size={24} className="animate-spin text-gray-400" />
          </div>
        ) : !display || display.status === 'idle' ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white py-20 text-gray-400">
            <ShoppingCart size={48} />
            <p className="text-sm font-medium">No active sale</p>
            <p className="text-xs">Waiting for cashier to start a transaction…</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-purple-700 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">
                Current Order
              </p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Item
                  </th>
                  <th className="px-5 py-2 text-center text-xs font-semibold uppercase text-gray-500">
                    Qty
                  </th>
                  <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-gray-500">
                    Price
                  </th>
                  <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(display.lines ?? []).map((line, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3 font-medium text-gray-800">{line.itemName}</td>
                    <td className="px-5 py-3 text-center text-gray-600">{line.quantity}</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(display.subtotal)}</span>
              </div>
              {display.discountTotal > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(display.discountTotal)}</span>
                </div>
              )}
              {display.taxTotal > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax</span>
                  <span>{formatCurrency(display.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-bold text-gray-900 border-t border-gray-200">
                <span>Total</span>
                <span className="text-purple-700">{formatCurrency(display.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
