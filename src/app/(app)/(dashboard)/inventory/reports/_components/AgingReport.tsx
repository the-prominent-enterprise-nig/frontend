'use client'
import ExportButton from '@/src/components/common/ExportButton'
import TablePagination from '@/src/components/common/TablePagination'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { useState, type ReactElement } from 'react'
import { useAgingCategoryOptions, type AgingFilters } from '../_hooks/useInventoryReports'
import {
  type AgingReportItem,
  type AgingReportResponse,
  type SerialAgingBucket,
  type UnitClassification,
  UnitClassificationSchema,
  UNIT_CLASSIFICATION_LABELS,
} from '@/src/schema/inventory/reports'

type Option = { id: string; name: string }

interface Props {
  data: AgingReportResponse | null | undefined
  isLoading: boolean
  isFetching: boolean
  page: number
  setPage: (page: number) => void
  /** The filters the report on screen was loaded with. */
  filters: AgingFilters
  onFiltersChange: (filters: AgingFilters) => void
  warehouses: Option[]
  /** Item types: the report's Types. */
  typeOptions: Option[]
}

type CardKey = SerialAgingBucket | 'total'

const CARDS: { key: CardKey; label: string; tone: string; figure: string }[] = [
  {
    key: '0_6',
    label: '0-6 months',
    tone: 'border-[#cfe9d7] bg-[#ddf1e4]',
    figure: 'text-[#2f6b3b]',
  },
  {
    key: '7_14',
    label: '7-14 months',
    tone: 'border-[#f1e2b0] bg-[#f8edc9]',
    figure: 'text-[#7a5a06]',
  },
  {
    key: '15_plus',
    label: '15 months and up',
    tone: 'border-[#f0cccc] bg-[#f8dcdc]',
    figure: 'text-[#8f1a2a]',
  },
  {
    key: 'total',
    label: 'Total',
    tone: 'border-[#8fbfdc] bg-[#d6eaf5]',
    figure: 'text-[#1f4e79]',
  },
]

/** Age-pill tone per bucket — the same colours as the cards above. */
const PILL_TONE: Record<SerialAgingBucket, string> = {
  '0_6': 'bg-[#ddf1e4] text-[#2f6b3b]',
  '7_14': 'bg-[#f8edc9] text-[#7a5a06]',
  '15_plus': 'bg-[#f8dcdc] text-[#8f1a2a]',
}

const COLUMNS = ['Serial', 'Model', 'Brand', 'Branch/Warehouse', 'Inbound Age', 'Store Age', 'Cost']

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const amount = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function bucketFor(months: number): SerialAgingBucket {
  if (months <= 6) return '0_6'
  if (months <= 14) return '7_14'
  return '15_plus'
}

function monthsLabel(months: number): string {
  if (months < 1) return '< 1 mo'
  return months === 1 ? '1 mo' : `${months} mos`
}

/** Only the two standalone warehouses keep the "Warehouse" suffix; other locations show bare names. */
function locationLabel(name: string | null): string {
  if (!name) return '—'
  return /^(panay|negros)\b/i.test(name) ? name : name.replace(/\s+warehouse$/i, '')
}

function SummaryCards({ data }: { data: AgingReportResponse }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const figures = card.key === 'total' ? data.totals : data.summary[card.key]
        return (
          <div key={card.key} className={`rounded-xl border-2 px-5 py-4 ${card.tone}`}>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-600">
              {card.label}
            </p>
            <p className={`mt-1 text-[32px] font-bold leading-tight ${card.figure}`}>
              {(figures?.count ?? 0).toLocaleString()}
            </p>
            <p className="text-[15px] text-zinc-600">{peso.format(figures?.totalValue ?? 0)}</p>
          </div>
        )
      })}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </div>
  )
}

function OptionSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder: string
  options: Option[]
}): ReactElement {
  return (
    <SearchableSelect
      value={value ?? ''}
      onChange={(v) => onChange(v || undefined)}
      placeholder={placeholder}
      ariaLabel={placeholder}
      clearable
      options={options.map((o) => ({ value: o.id, label: o.name }))}
    />
  )
}

/** Static: the three ways a unit can come into stock (SerialNumber.receivedAs). */
const CLASSIFICATION_OPTIONS: Option[] = UnitClassificationSchema.options.map((id) => ({
  id,
  name: UNIT_CLASSIFICATION_LABELS[id],
}))

type FilterBarProps = Pick<Props, 'warehouses' | 'typeOptions'> & {
  draft: AgingFilters
  onDraftChange: (patch: Partial<AgingFilters>) => void
  onProcess: () => void
  isDirty: boolean
}

/** The staged filters; they only reach the report on Process. */
function FilterBar({
  draft,
  onDraftChange: set,
  onProcess,
  isDirty,
  warehouses,
  typeOptions,
}: FilterBarProps): ReactElement {
  // Category follows the Type picked here, before Process.
  const categoryOptions = useAgingCategoryOptions(draft.typeId)
  return (
    <div className="flex flex-wrap items-end gap-4">
      <FilterField label="As of date">
        <input
          type="date"
          aria-label="As of date"
          value={draft.asOf}
          onChange={(e) => set({ asOf: e.target.value })}
          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-prominent-purple-600"
        />
      </FilterField>
      <FilterField label="Location">
        <OptionSelect
          value={draft.warehouseId}
          onChange={(warehouseId) => set({ warehouseId })}
          placeholder="All locations"
          options={warehouses.map((w) => ({ id: w.id, name: locationLabel(w.name) }))}
        />
      </FilterField>
      <FilterField label="Type">
        <OptionSelect
          value={draft.typeId}
          // A Category picked under the old Type may not exist under the new one.
          onChange={(typeId) => set({ typeId, categoryId: undefined })}
          placeholder="All types"
          options={typeOptions}
        />
      </FilterField>
      <FilterField label="Category">
        <OptionSelect
          value={draft.categoryId}
          onChange={(categoryId) => set({ categoryId })}
          placeholder="All categories"
          options={categoryOptions}
        />
      </FilterField>
      <FilterField label="Classification">
        <OptionSelect
          value={draft.classification}
          onChange={(classification) =>
            set({ classification: classification as UnitClassification | undefined })
          }
          placeholder="All classifications"
          options={CLASSIFICATION_OPTIONS}
        />
      </FilterField>
      <button
        type="button"
        onClick={onProcess}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-prominent-purple-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-purple-800"
      >
        {isDirty ? 'Process' : 'Refresh'}
      </button>
    </div>
  )
}

function AgePill({ months }: { months: number | null }): ReactElement {
  if (months === null) return <span className="text-zinc-400">—</span>
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-[12.5px] ${PILL_TONE[bucketFor(months)]}`}
    >
      {monthsLabel(months)}
    </span>
  )
}

function AgingRow({ row }: { row: AgingReportItem }): ReactElement {
  return (
    <tr className="even:bg-zinc-100/70">
      <td className="px-4 py-3 font-semibold text-zinc-900">{row.serialNumber}</td>
      <td className="px-4 py-3 text-zinc-700">{row.modelNumber ?? '—'}</td>
      <td className="px-4 py-3 text-zinc-700">{row.brandName ?? '—'}</td>
      <td className="px-4 py-3 text-zinc-700">{locationLabel(row.warehouseName)}</td>
      <td className="px-4 py-3 text-center">
        <AgePill months={row.inboundMonths} />
      </td>
      <td className="px-4 py-3 text-center">
        <AgePill months={row.storeMonths} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
        {amount.format(row.unitCost)}
      </td>
    </tr>
  )
}

function AgingTable({ data }: { data: AgingReportResponse }): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#4c1d95] text-left text-white">
            {COLUMNS.map((c) => (
              <th
                key={c}
                className={`px-4 py-3.5 font-medium ${c === 'Cost' ? 'text-right' : c.endsWith('Age') ? 'text-center' : ''}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row) => (
            <AgingRow key={row.serialNumberId} row={row} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-y border-zinc-200">
            <td colSpan={6} className="px-4 py-3 text-right font-semibold text-zinc-900">
              Total Cost:
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
              {peso.format(data.totals.totalValue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function TableState({ isLoading }: { isLoading: boolean }): ReactElement {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[48px] animate-pulse border-t border-zinc-100 bg-white" />
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-zinc-900">No units match</p>
      <p className="text-sm text-zinc-500">Try different filters.</p>
    </div>
  )
}

export default function AgingReport({
  data,
  isLoading,
  isFetching,
  page,
  setPage,
  filters,
  onFiltersChange,
  warehouses,
  typeOptions,
}: Props): ReactElement {
  const meta = data?.meta
  const pageSize = meta?.limit ?? 20
  const [draft, setDraft] = useState<AgingFilters>(filters)
  // Export is held back while the staged filters differ from the table's,
  // so the file can never disagree with the screen.
  const isDirty = JSON.stringify(draft) !== JSON.stringify(filters)

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Inventory Aging Report</h1>
          <p className="mt-1 text-sm text-ink-muted">
            How long each in-stock unit has been on hand.
          </p>
        </div>
        <ExportButton
          endpoint="/inventory/reports/aging/export"
          params={{ ...filters }}
          fallbackFilename="inventory-aging.xlsx"
          disabled={!data?.data.length || isDirty}
        />
      </div>

      {data && <SummaryCards data={data} />}

      <FilterBar
        draft={draft}
        onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onProcess={() => onFiltersChange({ ...draft, asOf: draft.asOf || filters.asOf })}
        isDirty={isDirty}
        warehouses={warehouses}
        typeOptions={typeOptions}
      />

      <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {data?.data.length ? <AgingTable data={data} /> : <TableState isLoading={isLoading} />}
        {meta && meta.lastPage > 1 && (
          <TablePagination
            page={page}
            pageCount={meta.lastPage}
            onPageChange={setPage}
            pageStart={(page - 1) * pageSize}
            pageSize={data?.data.length ?? 0}
            totalItems={meta.total}
            noun="unit"
          />
        )}
      </div>
    </div>
  )
}
