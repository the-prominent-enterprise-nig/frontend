'use client'

import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { segmentsApi } from '@/src/libs/api/crm'
import type { CustomerSegment } from '@/src/schema/crm/types'

export default function SegmentsList() {
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await segmentsApi.list()
    if (res.success && res.data) setSegments(res.data)
    else setError(res.error ?? 'Failed to load segments')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function refresh(id: string) {
    setRefreshing(id)
    await segmentsApi.refresh(id)
    setRefreshing(null)
    load()
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Customer Segments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dynamic groups for targeting — refresh to recount members.
        </p>
      </header>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
          Loading…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      )}

      {!loading && !error && segments.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No segments defined yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-gray-900">{s.name}</h2>
            {s.description && <p className="mt-1 text-[12.5px] text-gray-500">{s.description}</p>}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[13px] text-gray-600">
                <span className="text-lg font-semibold text-gray-900">{s.memberCount}</span> members
              </div>
              <button
                onClick={() => refresh(s.id)}
                disabled={refreshing === s.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${refreshing === s.id ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
            {s.lastRefreshedAt && (
              <p className="mt-2 text-[11px] text-gray-400">
                Refreshed {new Date(s.lastRefreshedAt).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
