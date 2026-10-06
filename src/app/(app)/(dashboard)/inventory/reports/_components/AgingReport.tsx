'use client'
import ExportButton from '@/src/components/common/ExportButton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { formatAge } from '@/src/libs/format/date'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import type { ReactElement } from 'react'
import type { AgingSort } from '../_hooks/useInventoryReports'
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
  warehouses: { id: string; name: string }[]
  warehouseId: string | undefined
  setWarehouseId: (v: string | undefined) => void
  categoryId: string | undefined
  setCategoryId: (v: string | undefined) => void
  categoryOptions: { id: string; name: string }[]
  sort: AgingSort
  onSort: (sort: AgingSort) => void
}

/** Column header that sorts the whole report; a second click flips direction. */
function SortableTh({
  label,
  by,
  sort,
  onSort,
  align,
}: {
  label: string
  by: AgingSort['by']
  sort: AgingSort
  onSort: (sort: AgingSort) => void
  align: 'left' | 'center'
}): ReactElement {
  const active = sort.by === by
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  const nextDir: AgingSort['dir'] = active && sort.dir === 'desc' ? 'asc' : 'desc'
  return (
    <th
      className={`px-4 py-[9px] font-medium text-${align}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort({ by, dir: nextDir })}
        className={`inline-flex cursor-pointer items-center gap-1 uppercase hover:text-[#17171c] ${active ? 'text-[#5b21b6]' : ''}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  )
}

// Same tones as the stock views' status pills, one per age bucket.
const BUCKET_TONE: Record<SerialAgingBucket, string> = {
  '0_30': 'bg-[#e7f5ef] text-[#0b6644]',
  '31_60': 'bg-[#fdf3d6] text-[#7a5a06]',
  '61_90': 'bg-[#fdebd5] text-[#9a4a06]',
  '91_180': 'bg-[#fdeceb] text-[#b42318]',
  '180_plus': 'bg-[#f9d4d1] text-[#8f1a12]',
}

const INPUT =
  'h-[38px] rounded-lg border bg-white px-3 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2] ' +
  CONTROL_CHROME.idle +
  ' focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

function Metric({
  label,
  count,
  highlight = false,
}: {
  label: string
  count: number
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
    </div>
  )
}

/** M-D-YY date-in, e.g. 01-29-26, matching the client's sheet. */
function formatDateIn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date
    .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
    .replace(/\//g, '-')
}

/** Only the two standalone warehouses keep the "Warehouse" suffix; other locations show bare names. */
function locationLabel(name: string): string {
  return /^(panay|negros)\b/i.test(name) ? name : name.replace(/\s+warehouse$/i, '')
}

/** Page number box: type a page and press Enter or click away to jump. */
function PageJump({
  page,
  totalPages,
  onJump,
}: {
  page: number
  totalPages: number
  onJump: (page: number) => void
}) {
  const commit = (input: HTMLInputElement): void => {
    const next = Math.min(totalPages, Math.max(1, Math.round(Number(input.value))))
    if (input.value.trim() === '' || Number.isNaN(next)) {
      input.value = String(page)
      return
    }
    onJump(next)
  }

  return (
    <input
      key={page}
      type="number"
      min={1}
      max={totalPages}
      defaultValue={page}
      aria-label="Go to page"
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(e.currentTarget)
      }}
      onBlur={(e) => commit(e.currentTarget)}
      className="h-7 w-14 rounded-lg border bg-white text-center text-[12.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}

export default function AgingReport({
  data,
  isLoading,
  isFetching,
  page,
  setPage,
  exportParams,
  filters,
  setFilter,
  warehouses,
  warehouseId,
  setWarehouseId,
  categoryId,
  setCategoryId,
  categoryOptions,
  sort,
  onSort,
}: Props) {
  const summary = data?.summary
  const meta = data?.meta
  const totalPages = meta?.lastPage ?? 1
  const totalRows = meta?.total ?? 0
  const pageSize = meta?.limit ?? 20
  const hasFilters = Boolean(
    filters.serial || warehouseId || filters.model || filters.receivedFrom || filters.receivedTo
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
            aria-label="Search serial, model, brand, RR or origin"
            placeholder="Search serial, model, brand, RR or origin…"
            value={filters.serial ?? ''}
            onChange={(e) => setFilter('serial', e.target.value)}
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
          />
        </label>
        <SearchableSelect
          className="w-[220px]"
          value={warehouseId ?? ''}
          onChange={(v) => setWarehouseId(v || undefined)}
          placeholder="All locations"
          chrome={CONTROL_CHROME}
          clearable
          options={warehouses.map((w) => ({
            value: w.id,
            label: locationLabel(w.name),
          }))}
        />
        <SearchableSelect
          className="w-[220px]"
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
              setFilter('serial', undefined)
              setWarehouseId(undefined)
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

      {/* Export */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#5b5b6b]">
          Each row is one physical in-stock serial, aged from its goods-receipt date.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[12.5px] text-[#5b5b6b]">
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
                  <SortableTh label="datein" by="dateIn" sort={sort} onSort={onSort} align="left" />
                  <th className="px-4 py-[9px] text-left font-medium">origin</th>
                  <th className="px-4 py-[9px] text-left font-medium">rr</th>
                  <th className="px-4 py-[9px] text-left font-medium">brand</th>
                  <th className="px-4 py-[9px] text-left font-medium">type</th>
                  <th className="px-4 py-[9px] text-left font-medium">model</th>
                  <th className="px-4 py-[9px] text-left font-medium">serial</th>
                  <th className="px-4 py-[9px] text-left font-medium">loc</th>
                  <SortableTh label="age" by="age" sort={sort} onSort={onSort} align="center" />
                </tr>
              </thead>
              <tbody>
                {data.data.map((row: AgingReportItem) => (
                  <tr
                    key={row.serialNumberId}
                    className="border-t border-[#f4f4f6] hover:bg-[#fcfcfd]"
                  >
                    <td className="px-4 py-[11px] text-[13px] text-[#5b5b6b]">
                      {row.noDate ? '—' : formatDateIn(row.receivedAt)}
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
                    <td className="px-4 py-[11px] text-[13px] text-[#5b5b6b]">
                      {row.warehouseName ? locationLabel(row.warehouseName) : '—'}
                    </td>
                    <td className="px-4 py-[11px] text-center">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${row.bucket ? BUCKET_TONE[row.bucket] : 'text-[#8b8b9b]'}`}
                      >
                        {row.noDate ? '—' : (row.importedAge ?? formatAge(row.receivedAt))}
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
            <span className="flex items-center gap-1.5 px-2 font-medium text-[#17171c]">
              <PageJump page={page} totalPages={totalPages} onJump={setPage} />
              <span>/ {totalPages}</span>
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
