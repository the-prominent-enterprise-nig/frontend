'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, Loader2, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { RestaurantFeedback, type FeedbackSummary } from '@/src/libs/data/RestaurantData'
import { CapabilityGuard } from '../_components/CapabilityGuard'

const PERIODS = [
  { label: 'Today', from: () => today(), to: () => today() },
  { label: 'This Week', from: () => weekStart(), to: () => today() },
  { label: 'This Month', from: () => monthStart(), to: () => today() },
  { label: 'All Time', from: () => undefined, to: () => undefined },
] as const

function today() {
  return new Date().toISOString().slice(0, 10)
}
function weekStart() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}
function monthStart() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </div>
  )
}

export default function FeedbackPage() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodIdx, setPeriodIdx] = useState(2)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const period = PERIODS[periodIdx]
    const from = period.from()
    const to = period.to()
    const res = await RestaurantFeedback.summary(from && to ? { from, to } : undefined)
    if (res.success && res.data) setSummary(res.data)
    else setError(res.message ?? 'Failed to load feedback')
    setLoading(false)
  }, [periodIdx])

  useEffect(() => {
    load()
  }, [load])

  const maxCount = summary ? Math.max(1, ...Object.values(summary.ratingDistribution)) : 1

  return (
    <CapabilityGuard capability="feedback">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                periodIdx === i
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading feedback...
          </div>
        ) : !summary ? null : (
          <>
            {/* Overview */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Avg Rating
                  </span>
                </div>
                <p className="text-4xl font-black text-gray-900 tabular-nums">
                  {summary.averageRating.toFixed(1)}
                </p>
                <StarRating value={summary.averageRating} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Responses
                  </span>
                </div>
                <p className="text-4xl font-black text-gray-900 tabular-nums">
                  {summary.totalResponses}
                </p>
                <p className="text-xs text-gray-400 mt-1">total reviews</p>
              </div>
            </div>

            {/* Rating distribution */}
            {Object.keys(summary.ratingDistribution).length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Rating Distribution</h2>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = summary.ratingDistribution[String(rating)] ?? 0
                    const pct = Math.round((count / maxCount) * 100)
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 w-20 shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
                            />
                          ))}
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs text-gray-500 tabular-nums">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* By server */}
            {summary.byServer.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">By Server</h2>
                <div className="space-y-3">
                  {summary.byServer
                    .sort((a, b) => b.averageRating - a.averageRating)
                    .map((s) => (
                      <div key={s.serverId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                            {s.serverName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{s.serverName}</p>
                            <p className="text-xs text-gray-400">
                              {s.responseCount} review{s.responseCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating value={s.averageRating} />
                          <span className="text-sm font-bold text-gray-700 tabular-nums w-8 text-right">
                            {s.averageRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {summary.totalResponses === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Star className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No feedback for this period</p>
              </div>
            )}
          </>
        )}
      </div>
    </CapabilityGuard>
  )
}
