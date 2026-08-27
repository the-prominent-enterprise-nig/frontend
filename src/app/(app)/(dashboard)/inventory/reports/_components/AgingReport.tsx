'use client'

import { Download, AlertTriangle, PackageX, X } from 'lucide-react'
import {
  SERIAL_AGING_BUCKET_LABELS,
  SerialAgingBucketSchema,
  type AgingReportResponse,
  type AgingReportItem,
  type SerialAgingBucket,
} from '@/src/schema/inventory/reports'

interface Props {
  data: AgingReportResponse | null | undefined
  isLoading: boolean
  isFetching: boolean
  bucketFilter: SerialAgingBucket | undefined
  setBucketFilter: (v: SerialAgingBucket | undefined) => void
  page: number
  setPage: (page: number) => void
}

const BUCKET_COLORS: Record<SerialAgingBucket, string> = {
  '0_30': 'bg-green-100 text-green-700',
  '31_60': 'bg-yellow-100 text-yellow-700',
  '61_90': 'bg-orange-100 text-orange-700',
  '91_180': 'bg-red-100 text-red-700',
  '180_plus': 'bg-red-200 text-red-800',
}

function exportToCsv(data: AgingReportResponse) {
  const headers = [
    'Serial Number',
    'Item Name',
    'SKU',
    'Location',
    'Received',
    'Days Since Receipt',
    'Unit Cost',
    'Bucket',
    'Slow Moving',
    'Should Be Out',
  ]
  const rows = data.data.map((row) => [
    row.serialNumber,
    row.name,
    row.sku,
    row.warehouseName ?? '',
    new Date(row.receivedAt).toLocaleDateString('en-PH'),
    row.daysSinceReceipt,
    row.unitCost.toFixed(2),
    SERIAL_AGING_BUCKET_LABELS[row.bucket],
    row.slowMoving ? 'Yes' : 'No',
    row.shouldBeOut ? 'Yes' : 'No',
  ])

  const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-aging-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AgingReport({
  data,
  isLoading,
  isFetching,
  bucketFilter,
  setBucketFilter,
  page,
  setPage,
}: Props) {
  const summary = data?.summary
  const meta = data?.meta
  const totalPages = meta?.lastPage ?? 1
  const totalRows = meta?.total ?? 0
  const pageSize = meta?.limit ?? 20

  const slowMovingCount = summary?.['91_180']?.count ?? 0
  const shouldBeOutCount = summary?.['180_plus']?.count ?? 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="aging-bucket-filter" className="sr-only">
          Filter by age bucket
        </label>
        <select
          id="aging-bucket-filter"
          aria-label="Filter by age bucket"
          value={bucketFilter ?? ''}
          onChange={(e) =>
            setBucketFilter((e.target.value || undefined) as SerialAgingBucket | undefined)
          }
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Ages</option>
          {SerialAgingBucketSchema.options.map((bucket) => (
            <option key={bucket} value={bucket}>
              {SERIAL_AGING_BUCKET_LABELS[bucket]}
            </option>
          ))}
        </select>

        {bucketFilter && (
          <button
            type="button"
            onClick={() => setBucketFilter(undefined)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* Bucket Summary Cards — always the full picture across every bucket,
          regardless of bucketFilter narrowing the table below. */}
      {!isLoading && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SerialAgingBucketSchema.options.map((bucket) => (
            <div key={bucket} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${BUCKET_COLORS[bucket]}`}
              >
                {SERIAL_AGING_BUCKET_LABELS[bucket]}
              </span>
              <p className="mt-3 text-2xl font-bold text-zinc-800">{summary[bucket]?.count ?? 0}</p>
              <p className="text-xs text-zinc-500">
                units · ₱{(summary[bucket]?.totalValue ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {!isLoading && (slowMovingCount > 0 || shouldBeOutCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {slowMovingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700">
                {slowMovingCount} slow-moving unit{slowMovingCount !== 1 ? 's' : ''} (91–180 days)
              </span>
            </div>
          )}
          {shouldBeOutCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <PackageX className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                {shouldBeOutCount} unit{shouldBeOutCount !== 1 ? 's' : ''} should be out (180+ days)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Each row is one physical in-stock serial, aged from its goods-receipt date.
        </p>
        {(data?.data?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => data && exportToCsv(data)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16">
            <PackageX className="mb-3 h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No aging inventory found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Serial
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Unit Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Days
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.data.map((row: AgingReportItem) => (
                  <tr key={row.serialNumberId} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {row.serialNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800">{row.name}</p>
                      <p className="mt-0.5 text-xs font-mono text-zinc-400">{row.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                      {row.warehouseName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 hidden md:table-cell">
                      ₱{row.unitCost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-700">
                      {row.daysSinceReceipt}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BUCKET_COLORS[row.bucket]}`}
                      >
                        {SERIAL_AGING_BUCKET_LABELS[row.bucket]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-medium text-zinc-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
