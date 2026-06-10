'use client'

import { AlertTriangle, Timer, RefreshCw } from 'lucide-react'
import { useExpiryTracking } from '../_hooks/useExpiryTracking'
import {
  getExpiryStatus,
  EXPIRY_STATUS_COLORS,
  EXPIRY_STATUS_LABELS,
  BATCH_STATUS_COLORS,
  BATCH_STATUS_LABELS,
} from '@/src/schema/inventory/batches'

export default function ExpiryDashboard() {
  const {
    sortedByExpiry,
    expiredCount,
    expiringSoonCount,
    pagination,
    isLoading,
    isFetching,
    error,
    tab,
    setTab,
    expiryWindowDays,
    setExpiryWindowDays,
    page,
    setPage,
  } = useExpiryTracking()

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">
              Expiry Date Tracking (FEFO)
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Monitor batch expiry dates. Batches are sorted First-Expired-First-Out.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={expiryWindowDays}
              onChange={(e) => setExpiryWindowDays(Number(e.target.value))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">Already Expired</p>
            <p className="mt-1 text-3xl font-bold text-red-900">{expiredCount}</p>
            <p className="mt-1 text-xs text-red-600">Batches past expiry date</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-medium text-amber-700">Expiring Soon</p>
            <p className="mt-1 text-3xl font-bold text-amber-900">{expiringSoonCount}</p>
            <p className="mt-1 text-xs text-amber-600">Within {expiryWindowDays} days</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-sm font-medium text-zinc-600">Total Monitored</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900">
              {expiredCount + expiringSoonCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Batches requiring attention</p>
          </div>
        </div>

        {/* Alerts */}
        {(expiredCount > 0 || expiringSoonCount > 0) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Action Required</p>
              <p className="mt-0.5 text-xs text-amber-700">
                {expiredCount > 0 &&
                  `${expiredCount} expired batch(es) should be quarantined or written off. `}
                {expiringSoonCount > 0 &&
                  `${expiringSoonCount} batch(es) expiring soon — prioritize in dispatch (FEFO).`}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-zinc-200">
          {(['expiring', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${tab === t ? 'border-prominent-purple-700 text-prominent-purple-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
            >
              {t === 'expiring'
                ? `Expiring / Expired (${expiredCount + expiringSoonCount})`
                : 'All Batches (FEFO Sorted)'}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load expiry data</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-zinc-300" />
              Loading batches…
            </div>
          ) : sortedByExpiry.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Timer className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">
                {tab === 'expiring'
                  ? `No batches expiring within ${expiryWindowDays} days`
                  : 'No batches with expiry dates'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Expiry Date
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Expiry Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Batch Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sortedByExpiry.map((batch) => {
                    const expiryStatus = getExpiryStatus(batch.expiryDate)
                    return (
                      <tr
                        key={batch.id}
                        className={`hover:bg-zinc-50 ${expiryStatus === 'expired' ? 'bg-red-50/50' : expiryStatus === 'expiring_soon' ? 'bg-amber-50/30' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-700">
                          {batch.batchNumber}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{batch.item?.name ?? '—'}</p>
                          {batch.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{batch.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-zinc-700">
                          {batch.expiryDate
                            ? new Date(batch.expiryDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${EXPIRY_STATUS_COLORS[expiryStatus]}`}
                          >
                            {EXPIRY_STATUS_LABELS[expiryStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${BATCH_STATUS_COLORS[batch.status]}`}
                          >
                            {BATCH_STATUS_LABELS[batch.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {tab === 'all' && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Page {page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
