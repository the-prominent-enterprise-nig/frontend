'use client'

import { useState } from 'react'
import { Star, Search, RefreshCw, ChevronRight } from 'lucide-react'
import { getLoyaltyByCustomer, getLoyaltyHistory } from '../_actions/pos-actions'
import type { LoyaltyAccount, LoyaltyTransaction } from '@/src/schema/pos'
import { PosDateTime } from '../_components/PosDate'

const eventTypeColor: Record<string, string> = {
  earned: 'bg-green-100 text-green-700',
  redeemed: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-500',
  adjusted: 'bg-yellow-100 text-yellow-700',
}

export default function LoyaltyPage() {
  const [customerId, setCustomerId] = useState('')
  const [searched, setSearched] = useState('')
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [history, setHistory] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    if (!customerId.trim()) return
    setLoading(true)
    setError('')
    setAccount(null)
    setHistory([])
    setSearched(customerId.trim())

    const accRes = await getLoyaltyByCustomer(customerId.trim())
    if (!accRes.success || !accRes.data) {
      setError(accRes.error ?? 'Loyalty account not found')
      setLoading(false)
      return
    }
    setAccount(accRes.data)

    const histRes = await getLoyaltyHistory(accRes.data.id)
    if (histRes.success && histRes.data) {
      setHistory(histRes.data)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty</h1>
          <p className="mt-1 text-sm text-gray-500">
            Look up customer loyalty accounts and point history.
          </p>
        </div>

        {/* Search */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-700">Customer Lookup</p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Enter Customer ID…"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !customerId.trim()}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Account Summary */}
        {account && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer ID
                </p>
                <p className="mt-0.5 font-mono text-sm text-gray-800">{searched}</p>
              </div>
              {account.tier && (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                  {account.tier}
                </span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <PointStat
                label="Current Points"
                value={account.currentPoints.toLocaleString()}
                accent
              />
              <PointStat label="Lifetime Earned" value={account.lifetimeEarned.toLocaleString()} />
              <PointStat
                label="Lifetime Redeemed"
                value={account.lifetimeRedeemed.toLocaleString()}
              />
            </div>
          </div>
        )}

        {/* History */}
        {account && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-sm font-semibold text-gray-700">Point History</p>
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                <Star size={36} />
                <p className="text-sm">No history yet.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Event
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Points
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Balance After
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventTypeColor[h.eventType]}`}
                        >
                          {h.eventType}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${h.pointsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {h.pointsChange >= 0 ? '+' : ''}
                        {h.pointsChange}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {h.balanceAfter.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        <PosDateTime iso={h.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Empty state when no search yet */}
        {!account && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 py-16 text-gray-400">
            <Star size={40} />
            <p className="text-sm">Search for a customer to view their loyalty account.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PointStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-purple-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
