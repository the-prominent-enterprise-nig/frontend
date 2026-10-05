'use client'
import ExportButton from '@/src/components/common/ExportButton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { formatShortDate } from '@/src/libs/format/date'
import { AlertTriangle, PackageX, Search, X } from 'lucide-react'
import { CONTROL_CHROME, MONO, PLEX } from '../../purchase-orders/_components/procurementTokens'
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
  /** The filters this report was loaded with, minus paging — the Excel
   * export returns every matching row, with pivot tables. */
  exportParams: Record<string, string | number | undefined>
  filters: {
    serial?: string
    brandId?: string
    model?: string
    receivedFrom?: string
    receivedTo?: string
  }
  setFilter: (
    key: 'serial' | 'brandId' | 'model' | 'receivedFrom' | 'receivedTo',
    value: string | undefined
  ) => void
  brands: { id: string; name: string }[]
  categoryId: string | undefined
  setCategoryId: (v: string | undefined) => void
  categoryOptions: { id: string; name: string }[]
}

// Same tones as the stock views' status pills, one per age bucket.
const BUCKET_TONE: Record<SerialAgingBucket, string> = {
  '0_30': 'bg-[#e7f5ef] text-[#0b6644]',
  '31_60': 'bg-[#fdf3d6] text-[#7a5a06]',
  '61_90': 'bg-[#fdebd5] text-[#9a4a06]',
  '91_180': 'bg-[#fdeceb] text-[#b42318]',
  '180_plus': 'bg-[#f9d4d1] text-[#8f1a12]',
}

const bucketOptions = SerialAgingBucketSchema.options.map((b) => ({
  value: b,
  label: SERIAL_AGING_BUCKET_LABELS[b],
}))

const INPUT =
  'h-[38px] rounded-lg border bg-white px-3 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2] ' +
  CONTROL_CHROME.idle +
  ' focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

function Metric({
  label,
  count,
  value,
  highlight = false,
}: {
  label: string
  count: number
  value: number
  highlight?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 ${highlight ? 'bg-[#f4fbf7]' : ''}`}>
      <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
        {label}
      </span>
      <span className={`${MONO} text-[20px] font-semibold tracking-[-.01em]`}>
        {count.toLocaleString()}
      </span>
      <span className="text-[12px] text-[#8b8b9b]">₱{value.toLocaleString()}</span>
    </div>
  )
}

export default function AgingReport({
  data,
  isLoading,
  isFetching,
  bucketFilter,
  setBucketFilter,
  page,
  setPage,
  exportParams,
  filters,
  setFilter,
  brands,
  categoryId,
  setCategoryId,
  categoryOptions,
}: Props) {
  const summary = data?.summary
  const meta = data?.meta
  const totalPages = meta?.lastPage ?? 1
  const totalRows = meta?.total ?? 0
  const pageSize = meta?.limit ?? 20
  const slowMovingCount = summary?.['91_180']?.count ?? 0
  const shouldBeOutCount = summary?.['180_plus']?.count ?? 0
  const hasFilters = Boolean(
    bucketFilter ||
    filters.serial ||
    filters.brandId ||
    filters.model ||
    filters.receivedFrom ||
    filters.receivedTo
  )

  return (
    <div className={`${PLEX} flex flex-col gap-[14px] text-[#17171c] antialiased`}>
      {/* Metric band — every bucket, whatever the table below is filtered to. */}
      {!isLoading && summary && (
        <div className="grid grid-cols-2 divide-x divide-y divide-[#eeeef1] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white min-[640px]:grid-cols-3 min-[1080px]:grid-cols-5 min-[1080px]:divide-y-0">
          {SerialAgingBucketSchema.options.map((bucket) => (
            <Metric
              key={bucket}
              label={SERIAL_AGING_BUCKET_LABELS[bucket]}
              count={summary[bucket]?.count ?? 0}
              value={summary[bucket]?.totalValue ?? 0}
              highlight={bucket === '0_30'}
            />
          ))}
        </div>
      )}

      {/* Filter bar — same row as the stock views. */}
      <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
        <label
          className={`flex h-[38px] min-w-[180px] flex-[1_1_180px] items-center gap-[9px] rounded-lg border px-3 ${CONTROL_CHROME.idle} focus-within:border-[#5b21b6] focus-within:shadow-[0_0_0_3px_#f0e9fc]`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[#8b8b9b]" />
          <input
            type="search"
            aria-label="Search serial or model"
            placeholder="Search serial or model…"
            value={filters.serial ?? ''}
            onChange={(e) => setFilter('serial', e.target.value)}
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
          />
        </label>
        <SearchableSelect
          className="w-[150px]"
          value={bucketFilter ?? ''}
          onChange={(v) => setBucketFilter((v || undefined) as SerialAgingBucket | undefined)}
          placeholder="All ages"
          chrome={CONTROL_CHROME}
          clearable
          options={bucketOptions}
        />
        <SearchableSelect
          className="w-[150px]"
          value={filters.brandId ?? ''}
          onChange={(v) => setFilter('brandId', v)}
          placeholder="All brands"
          chrome={CONTROL_CHROME}
          clearable
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <SearchableSelect
          className="w-[150px]"
          value={categoryId ?? ''}
          onChange={(v) => setCategoryId(v || undefined)}
          placeholder="All categories"
          chrome={CONTROL_CHROME}
          clearable
          options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setBucketFilter(undefined)
              setFilter('serial', undefined)
              setFilter('brandId', undefined)
              setFilter('receivedFrom', undefined)
              setFilter('receivedTo', undefined)
              setCategoryId(undefined)
            }}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Alerts */}
      {!isLoading && (slowMovingCount > 0 || shouldBeOutCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {slowMovingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f3d9b5] bg-[#fdf6ec] px-3.5 py-2">
              <AlertTriangle className="h-4 w-4 text-[#b45309]" />
              <span className="text-[12.5px] font-medium text-[#7a4a06]">
                {slowMovingCount} slow-moving unit{slowMovingCount !== 1 ? 's' : ''} (91–180 days)
              </span>
            </div>
          )}
          {shouldBeOutCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f3c9c5] bg-[#fdeceb] px-3.5 py-2">
              <PackageX className="h-4 w-4 text-[#b42318]" />
              <span className="text-[12.5px] font-medium text-[#b42318]">
                {shouldBeOutCount} unit{shouldBeOutCount !== 1 ? 's' : ''} should be out (180+ days)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#5b5b6b]">
          Each row is one physical in-stock serial, aged from its goods-receipt date.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[12.5px] text-[#5b5b6b]">
            <span>RR</span>
            <input
              type="date"
              aria-label="RR date from"
              value={filters.receivedFrom ?? ''}
              onChange={(e) => setFilter('receivedFrom', e.target.value)}
              className={INPUT}
            />
            <span>to</span>
            <input
              type="date"
              aria-label="RR date to"
              value={filters.receivedTo ?? ''}
              onChange={(e) => setFilter('receivedTo', e.target.value)}
              className={INPUT}
            />
          </div>
          <ExportButton
            endpoint="/inventory/reports/aging/export"
            params={exportParams}
            fallbackFilename="inventory-aging.xlsx"
            disabled={!data?.data?.length}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[52px] animate-pulse border-t border-[#f4f4f6] bg-white" />
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <p className="text-[14px] font-semibold text-[#17171c]">No units match</p>
            <p className="text-[13px] text-[#8b8b9b]">
              {hasFilters ? 'Clear the filters to see more.' : 'Nothing is in stock to age yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[11.5px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                >
                  <th className="px-4 py-[9px] text-left font-medium">Date in</th>
                  <th className="px-4 py-[9px] text-left font-medium">Origin</th>
                  <th className="px-4 py-[9px] text-left font-medium">RR #</th>
                  <th className="px-4 py-[9px] text-left font-medium">Brand</th>
                  <th className="px-4 py-[9px] text-left font-medium">Type</th>
                  <th className="px-4 py-[9px] text-left font-medium">Model</th>
                  <th className="px-4 py-[9px] text-left font-medium">Serial #</th>
                  <th className="px-4 py-[9px] text-right font-medium">Days</th>
                  <th className="px-4 py-[9px] text-center font-medium">Age</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row: AgingReportItem) => (
                  <tr
                    key={row.serialNumberId}
                    className="border-t border-[#f4f4f6] hover:bg-[#fcfcfd]"
                  >
                    <td className="px-4 py-[11px] text-[13px] text-[#5b5b6b]">
                      {formatShortDate(row.receivedAt)}
                    </td>
                    <td className="px-4 py-[11px] text-[13.5px] text-[#17171c]">
                      {row.origin ?? '—'}
                    </td>
                    <td className={`${MONO} px-4 py-[11px] text-[12.5px] text-[#5b21b6]`}>
                      {row.rrNumber ?? '—'}
                    </td>
                    <td className="px-4 py-[11px] text-[13.5px] text-[#5b5b6b]">
                      {row.brandName ?? '—'}
                    </td>
                    <td className="px-4 py-[11px] text-[13.5px] text-[#5b5b6b]">
                      {row.typeName ?? '—'}
                    </td>
                    <td className="px-4 py-[11px] text-[13.5px] font-medium text-[#17171c]">
                      {row.modelNumber ?? '—'}
                    </td>
                    <td
                      className={`${MONO} px-4 py-[11px] text-[14px] font-semibold text-[#17171c]`}
                    >
                      {row.serialNumber}
                    </td>
                    <td className={`${MONO} px-4 py-[11px] text-right text-[14.5px] font-semibold`}>
                      {row.daysSinceReceipt}
                    </td>
                    <td className="px-4 py-[11px] text-center">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${BUCKET_TONE[row.bucket]}`}
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
        <div className="flex items-center justify-between text-[12.5px] text-[#5b5b6b]">
          <span className={MONO}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-2.5 py-1 hover:bg-[#f1ebfb] disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-medium text-[#17171c]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-2.5 py-1 hover:bg-[#f1ebfb] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
