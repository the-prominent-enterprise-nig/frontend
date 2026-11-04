'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  Play,
  Plus,
  Rows3,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  QueryCenter as QueryCenterApi,
  type DatasetQuery,
  type FilterOp,
  type QueryColumn,
  type QueryDataset,
  type QueryFilter,
  type QueryResult,
} from '@/src/libs/data/QueryCenterData'

// Scenario 62 — the Data Query Center: pick a dataset (any table in any
// module), choose columns, filter, sort, preview, export. Read-only by
// construction; the backend only ever runs findMany/count against a
// whitelisted column set, scoped to the owner's business. No modals: the
// export preview replaces the results card in place.

const PAGE_SIZE = 100
const EXPORT_PREVIEW_ROWS = 10
const EXPORT_MAX_ROWS = 100_000

type ExportFormat = 'xlsx' | 'csv'
type Sort = { column: string; dir: 'asc' | 'desc' } | null

/** The datasets people actually reach for, under the names they use. Shown
 * first in the browser and as the start screen's cards. */
const COMMON: { key: string; label: string; hint: string; columns: string[] }[] = [
  {
    key: 'Transaction',
    label: 'General ledger lines',
    hint: 'Every posted debit and credit',
    columns: [
      'date',
      'journalEntry.code',
      'account.number',
      'description',
      'debitAmount',
      'creditAmount',
      'status',
    ],
  },
  {
    key: 'JournalEntry',
    label: 'Journal entries',
    hint: 'One row per journal entry',
    columns: [
      'date',
      'code',
      'description',
      'journalType',
      'sourceModule',
      'sourceDocumentNo',
      'referenceNumber',
      'status',
      'branch.name',
      'postedBy',
    ],
  },
  {
    key: 'ARInvoice',
    label: 'Sales invoices (AR)',
    hint: 'Customer invoices and balances',
    columns: [
      'invoiceNumber',
      'customer.firstName',
      'invoiceDate',
      'dueDate',
      'totalAmount',
      'amountPaid',
      'status',
      'branch.name',
    ],
  },
  {
    key: 'ARPayment',
    label: 'Collections (AR)',
    hint: 'Payments received from customers',
    columns: [
      'paymentDate',
      'arInvoice.invoiceNumber',
      'amount',
      'method',
      'reference',
      'withholdingAmount',
      'branch.name',
      'collector.name',
    ],
  },
  {
    key: 'APBill',
    label: 'Supplier bills (AP)',
    hint: 'Bills and what is still owed',
    columns: [
      'billNumber',
      'supplier.name',
      'billDate',
      'dueDate',
      'totalAmount',
      'amountPaid',
      'status',
      'voucherNumber',
    ],
  },
  {
    key: 'APPayment',
    label: 'Supplier payments (AP)',
    hint: 'Payments made to suppliers',
    columns: [
      'paymentDate',
      'apBill.billNumber',
      'disbursement.voucherNumber',
      'amount',
      'withholdingAmount',
      'method',
      'chequeNumber',
      'reference',
    ],
  },
  {
    key: 'BusinessExpenseLine',
    label: 'Expense lines',
    hint: 'Expenses and payroll, line by line',
    columns: [
      'expense.expenseNumber',
      'categoryAccount.number',
      'payee',
      'description',
      'amount',
      'taxAmount',
      'isSpecialAccount',
      'divisionBranch.name',
    ],
  },
  {
    key: 'PosTransaction',
    label: 'POS sales',
    hint: 'Every point-of-sale transaction',
    columns: [
      'occurredAt',
      'transactionNumber',
      'transactionType',
      'salesInvoiceNumber',
      'subtotal',
      'discountTotal',
      'taxTotal',
      'totalAmount',
      'status',
      'sellingAgent.name',
    ],
  },
  {
    key: 'StockLedger',
    label: 'Stock movements',
    hint: 'Every stock in and out',
    columns: [
      'occurredAt',
      'item.name',
      'warehouse.name',
      'transactionType',
      'quantityChange',
      'beforeQty',
      'afterQty',
      'unitCost',
      'referenceType',
    ],
  },
  {
    key: 'Customer',
    label: 'Customers',
    hint: 'The customer master list',
    columns: [
      'customerCode',
      'name',
      'customerType',
      'phone',
      'email',
      'address',
      'creditLimit',
      'status',
      'branch.name',
    ],
  },
]
const COMMON_BY_KEY = new Map(COMMON.map((c) => [c.key, c]))
const friendlyName = (d: QueryDataset) => COMMON_BY_KEY.get(d.key)?.label ?? d.label

const OPS: { op: FilterOp; label: string; types: QueryColumn['type'][]; noValue?: boolean }[] = [
  { op: 'eq', label: 'is', types: ['string', 'number', 'date', 'enum', 'boolean'] },
  { op: 'neq', label: 'is not', types: ['string', 'number', 'enum', 'boolean'] },
  { op: 'contains', label: 'contains', types: ['string'] },
  { op: 'startsWith', label: 'starts with', types: ['string'] },
  { op: 'gte', label: 'is at least / on or after', types: ['number', 'date'] },
  { op: 'lte', label: 'is at most / on or before', types: ['number', 'date'] },
  { op: 'gt', label: 'is more than / after', types: ['number', 'date'] },
  { op: 'lt', label: 'is less than / before', types: ['number', 'date'] },
  { op: 'in', label: 'is one of (a, b, …)', types: ['string', 'number', 'enum'] },
  { op: 'isEmpty', label: 'is empty', types: ['string', 'number', 'date', 'enum'], noValue: true },
  {
    op: 'isNotEmpty',
    label: 'is not empty',
    types: ['string', 'number', 'date', 'enum'],
    noValue: true,
  },
]
const OP_LABEL = Object.fromEntries(OPS.map((o) => [o.op, o.label])) as Record<FilterOp, string>

/** Record ids and foreign-key ids are opaque uuids — hidden by default (still
 * available in the column picker). */
const isInternalId = (c: QueryColumn) => c.key === 'id' || !!c.isForeignKey

/** The columns a dataset opens with: the curated set for a most-used one
 * (in that order), otherwise everything except internal ids. */
function defaultColumns(d: QueryDataset): string[] {
  const available = new Set(d.columns.map((c) => c.key))
  const curated = COMMON_BY_KEY.get(d.key)?.columns.filter((k) => available.has(k))
  return curated?.length ? curated : d.columns.filter((c) => !isInternalId(c)).map((c) => c.key)
}

function formatCell(v: unknown, col: QueryColumn): string {
  if (v === null || v === undefined || v === '') return '—'
  if (col.type === 'date') {
    const s = String(v)
    return s.length >= 10 ? s.slice(0, 19).replace('T', ' ').replace(' 00:00:00', '') : s
  }
  if (col.type === 'number' && typeof v === 'number')
    return v.toLocaleString('en-PH', { maximumFractionDigits: 6 })
  if (col.type === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

const card = 'rounded-xl border border-gray-200 bg-white shadow-sm'
const inputCls =
  'h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'

export default function QueryCenter() {
  const [datasets, setDatasets] = useState<QueryDataset[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataset, setDataset] = useState<QueryDataset | null>(null)

  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [sort, setSort] = useState<Sort>(null)

  const [result, setResult] = useState<QueryResult | null>(null)
  const [lastRun, setLastRun] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [exportPreview, setExportPreview] = useState<{
    format: ExportFormat
    data: QueryResult
  } | null>(null)
  const [preparing, setPreparing] = useState<ExportFormat | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  useEffect(() => {
    QueryCenterApi.datasets().then((res) => {
      if (res.success && res.data) setDatasets(res.data)
      else setLoadError(res.message || res.error || 'Could not load datasets.')
    })
  }, [])

  const activeFilters = filters.filter((f) => f.column)
  const query = (nextOffset: number): DatasetQuery => ({
    columns,
    filters: activeFilters,
    sort: sort ?? undefined,
    limit: PAGE_SIZE,
    offset: nextOffset,
  })
  // What the results on screen were run with, to flag them as stale once
  // the builder changes.
  const signature = JSON.stringify({ columns, filters: activeFilters, sort })
  const stale = !!result && lastRun !== signature

  const run = async (ds: QueryDataset | null = dataset, nextOffset = 0, q?: DatasetQuery) => {
    if (!ds) return
    setRunning(true)
    setError(null)
    const res = await QueryCenterApi.preview(ds.key, q ?? query(nextOffset))
    setRunning(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Query failed.')
      return
    }
    setResult(res.data)
    setOffset(nextOffset)
    setExportPreview(null)
    setLastRun(
      q
        ? JSON.stringify({
            columns: q.columns ?? [],
            filters: q.filters ?? [],
            sort: q.sort ?? null,
          })
        : signature
    )
  }

  const pick = (d: QueryDataset) => {
    const defaults = defaultColumns(d)
    setDataset(d)
    setColumns(defaults)
    setFilters([])
    setSort(d.defaultSort)
    setResult(null)
    setExportPreview(null)
    run(d, 0, {
      columns: defaults,
      filters: [],
      sort: d.defaultSort ?? undefined,
      limit: PAGE_SIZE,
    })
  }

  const openExportPreview = async (format: ExportFormat) => {
    if (!dataset) return
    setPreparing(format)
    setError(null)
    const res = await QueryCenterApi.preview(dataset.key, {
      ...query(0),
      limit: EXPORT_PREVIEW_ROWS,
    })
    setPreparing(null)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not prepare the export preview.')
      return
    }
    setExportPreview({ format, data: res.data })
  }

  const doExport = async (format: ExportFormat) => {
    if (!dataset) return
    setExporting(format)
    await QueryCenterApi.export(dataset.key, query(0), format)
    setExporting(null)
  }

  const colLabel = (key: string) => dataset?.columns.find((c) => c.key === key)?.label ?? key

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50/60">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
          <Database className="h-6 w-6 text-purple-700" /> Data Query Center
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only raw data from every module. Pick a dataset, narrow it down, and export it to
          Excel or CSV.
        </p>
      </div>

      <div className="flex gap-6 p-6">
        <DatasetBrowser
          datasets={datasets}
          loadError={loadError}
          selected={dataset?.key ?? null}
          onPick={pick}
        />

        <main className="min-w-0 flex-1 space-y-4">
          {!dataset ? (
            <StartScreen datasets={datasets} onPick={pick} />
          ) : (
            <>
              <DatasetHeader
                dataset={dataset}
                total={result?.total ?? null}
                preparing={preparing}
                disabled={columns.length === 0}
                onExport={openExportPreview}
              />

              <QueryBuilder
                dataset={dataset}
                columns={columns}
                setColumns={setColumns}
                filters={filters}
                setFilters={setFilters}
                sort={sort}
                setSort={setSort}
                running={running}
                stale={stale}
                onRun={() => run()}
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {exportPreview ? (
                <ExportPreview
                  datasetLabel={friendlyName(dataset)}
                  preview={exportPreview}
                  filters={activeFilters}
                  sort={sort}
                  colLabel={colLabel}
                  exporting={exporting}
                  onDownload={doExport}
                  onBack={() => setExportPreview(null)}
                />
              ) : (
                result && (
                  <Results
                    result={result}
                    offset={offset}
                    running={running}
                    stale={stale}
                    onPage={(o) => run(dataset, o)}
                  />
                )
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Dataset browser ─────────────────────────────────────────────────────────

function DatasetBrowser({
  datasets,
  loadError,
  selected,
  onPick,
}: {
  datasets: QueryDataset[]
  loadError: string | null
  selected: string | null
  onPick: (d: QueryDataset) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const term = search.trim().toLowerCase()

  const matches = (d: QueryDataset) =>
    !term || `${friendlyName(d)} ${d.label} ${d.module} ${d.key}`.toLowerCase().includes(term)

  const common = COMMON.map((c) => datasets.find((d) => d.key === c.key)).filter(
    (d): d is QueryDataset => !!d && matches(d)
  )
  const groups = useMemo(() => {
    const map = new Map<string, QueryDataset[]>()
    for (const d of datasets) {
      if (!matches(d)) continue
      map.set(d.module, [...(map.get(d.module) ?? []), d])
    }
    return [...map.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, term])

  const item = (d: QueryDataset, label: string) => (
    <button
      key={d.key}
      onClick={() => onPick(d)}
      className={`block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm ${
        selected === d.key
          ? 'bg-purple-100 font-medium text-purple-800'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      title={d.label}
    >
      {label}
    </button>
  )

  return (
    <aside className={`${card} sticky top-4 flex max-h-[calc(100vh-7rem)] w-72 shrink-0 flex-col`}>
      <div className="border-b border-gray-100 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${datasets.length || ''} datasets…`}
            className={`${inputCls} w-full pl-8`}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loadError && <p className="p-2 text-xs text-red-600">{loadError}</p>}

        {common.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
              <Sparkles className="h-3.5 w-3.5" /> Most used
            </div>
            {common.map((d) => item(d, friendlyName(d)))}
          </div>
        )}

        <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          All data by module
        </div>
        {groups.map(([module, items]) => {
          const expanded = !!term || open[module] || items.some((d) => d.key === selected)
          return (
            <div key={module}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [module]: !expanded }))}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
                  />
                  {module}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  {items.length}
                </span>
              </button>
              {expanded && (
                <div className="ml-4 border-l border-gray-100 pl-1">
                  {items.map((d) => item(d, d.label))}
                </div>
              )}
            </div>
          )
        })}
        {term && !common.length && !groups.length && (
          <p className="px-2.5 py-4 text-sm text-gray-400">No dataset matches “{search}”.</p>
        )}
      </div>
    </aside>
  )
}

function StartScreen({
  datasets,
  onPick,
}: {
  datasets: QueryDataset[]
  onPick: (d: QueryDataset) => void
}) {
  const common = COMMON.map((c) => ({ c, d: datasets.find((d) => d.key === c.key) })).filter(
    (x): x is { c: (typeof COMMON)[number]; d: QueryDataset } => !!x.d
  )
  return (
    <div className={`${card} p-6`}>
      <h2 className="text-lg font-semibold text-gray-900">Start with one of these</h2>
      <p className="mt-1 text-sm text-gray-500">
        Or browse every table on the left — {datasets.length} datasets across all modules.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {common.map(({ c, d }) => (
          <button
            key={c.key}
            onClick={() => onPick(d)}
            className="group rounded-xl border border-gray-200 p-4 text-left transition hover:border-purple-300 hover:bg-purple-50/50"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-purple-800">
              <Database className="h-4 w-4 text-purple-600" /> {c.label}
            </div>
            <p className="mt-1 text-xs text-gray-500">{c.hint}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-gray-400">{d.module}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Header and query builder ────────────────────────────────────────────────

function DatasetHeader({
  dataset,
  total,
  preparing,
  disabled,
  onExport,
}: {
  dataset: QueryDataset
  total: number | null
  preparing: ExportFormat | null
  disabled: boolean
  onExport: (f: ExportFormat) => void
}) {
  const hint = COMMON_BY_KEY.get(dataset.key)?.hint
  return (
    <div className={`${card} flex flex-wrap items-center justify-between gap-4 px-5 py-4`}>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {dataset.module}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{friendlyName(dataset)}</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {hint ? `${hint} · ` : ''}
          {dataset.columns.length} columns available
          {total !== null && ` · ${total.toLocaleString()} matching row${total === 1 ? '' : 's'}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Export</span>
        {(['xlsx', 'csv'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onExport(f)}
            disabled={!!preparing || disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-purple-300 hover:text-purple-800 disabled:opacity-50"
          >
            {f === 'xlsx' ? (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            ) : (
              <FileText className="h-4 w-4 text-gray-500" />
            )}
            {preparing === f ? 'Preparing…' : f === 'xlsx' ? 'Excel' : 'CSV'}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[9rem_1fr] md:gap-4">
      <div className="flex items-center gap-2 pt-1.5 text-sm font-medium text-gray-700 md:items-start">
        {icon} {title}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function QueryBuilder({
  dataset,
  columns,
  setColumns,
  filters,
  setFilters,
  sort,
  setSort,
  running,
  stale,
  onRun,
}: {
  dataset: QueryDataset
  columns: string[]
  setColumns: React.Dispatch<React.SetStateAction<string[]>>
  filters: QueryFilter[]
  setFilters: React.Dispatch<React.SetStateAction<QueryFilter[]>>
  sort: Sort
  setSort: (s: Sort) => void
  running: boolean
  stale: boolean
  onRun: () => void
}) {
  const queryable = dataset.columns.filter((c) => c.queryable)
  const colByKey = (key: string) => dataset.columns.find((c) => c.key === key)
  const updateFilter = (i: number, patch: Partial<QueryFilter>) =>
    setFilters((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  return (
    <div className={`${card} px-5 py-2`}>
      <div className="divide-y divide-gray-100">
        <Section icon={<Columns3 className="h-4 w-4 text-gray-400" />} title="Columns">
          <ColumnPicker dataset={dataset} columns={columns} setColumns={setColumns} />
        </Section>

        <Section icon={<Filter className="h-4 w-4 text-gray-400" />} title="Filters">
          <div className="space-y-2">
            {filters.length === 0 && (
              <p className="pt-1.5 text-sm text-gray-400">No filters — every row is included.</p>
            )}
            {filters.map((f, i) => {
              const col = colByKey(f.column)
              const ops = OPS.filter((o) => !col || o.types.includes(col.type))
              const noValue = OPS.find((o) => o.op === f.op)?.noValue
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2"
                >
                  <select
                    aria-label="Filter column"
                    value={f.column}
                    onChange={(e) => {
                      const next = colByKey(e.target.value)
                      const firstOp = OPS.find((o) => next && o.types.includes(next.type))
                      updateFilter(i, {
                        column: e.target.value,
                        op: firstOp?.op ?? 'eq',
                        value: '',
                      })
                    }}
                    className={`${inputCls} min-w-44`}
                  >
                    <option value="">Choose a column…</option>
                    {queryable.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter operator"
                    value={f.op}
                    onChange={(e) => updateFilter(i, { op: e.target.value as FilterOp })}
                    className={inputCls}
                    disabled={!f.column}
                  >
                    {ops.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {!noValue && (
                    <FilterValue
                      col={col}
                      filter={f}
                      onChange={(value) => updateFilter(i, { value })}
                      onEnter={onRun}
                    />
                  )}
                  <button
                    onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}
                    aria-label="Remove filter"
                    className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
            <button
              onClick={() => setFilters((fs) => [...fs, { column: '', op: 'eq', value: '' }])}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-purple-700 hover:bg-purple-50"
            >
              <Plus className="h-4 w-4" /> Add filter
            </button>
          </div>
        </Section>

        <Section
          icon={
            sort?.dir === 'asc' ? (
              <ArrowUpAZ className="h-4 w-4 text-gray-400" />
            ) : (
              <ArrowDownAZ className="h-4 w-4 text-gray-400" />
            )
          }
          title="Sort by"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Sort column"
              value={sort?.column ?? ''}
              onChange={(e) =>
                setSort(e.target.value ? { column: e.target.value, dir: sort?.dir ?? 'asc' } : null)
              }
              className={`${inputCls} min-w-44`}
            >
              <option value="">No particular order</option>
              {queryable.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            {sort && (
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
                {(['asc', 'desc'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSort({ ...sort, dir: d })}
                    className={`px-3 py-1.5 text-sm ${
                      sort.dir === d
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {d === 'asc' ? 'Ascending' : 'Descending'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 py-3">
        {stale && (
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            You changed the query — run it to update the results.
          </span>
        )}
        <button
          onClick={onRun}
          disabled={running || columns.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> {running ? 'Running…' : 'Run query'}
        </button>
      </div>
    </div>
  )
}

function FilterValue({
  col,
  filter,
  onChange,
  onEnter,
}: {
  col: QueryColumn | undefined
  filter: QueryFilter
  onChange: (v: string) => void
  onEnter: () => void
}) {
  if (col?.type === 'enum' && filter.op !== 'in') {
    return (
      <select
        aria-label="Filter value"
        value={filter.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">Choose…</option>
        {col.enumValues?.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    )
  }
  if (col?.type === 'boolean') {
    return (
      <select
        aria-label="Filter value"
        value={filter.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">Choose…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }
  return (
    <input
      aria-label="Filter value"
      placeholder={filter.op === 'in' ? 'a, b, c' : 'Value'}
      type={
        col?.type === 'date'
          ? 'date'
          : col?.type === 'number' && filter.op !== 'in'
            ? 'number'
            : 'text'
      }
      value={filter.value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      disabled={!col}
      className={`${inputCls} min-w-40 flex-1`}
    />
  )
}

function ColumnPicker({
  dataset,
  columns,
  setColumns,
}: {
  dataset: QueryDataset
  columns: string[]
  setColumns: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // A newly ticked column goes last, so the curated order isn't reshuffled.
  const toggle = (key: string) =>
    setColumns((cs) => (cs.includes(key) ? cs.filter((c) => c !== key) : [...cs, key]))
  const shown = dataset.columns.filter((c) => c.label.toLowerCase().includes(term.toLowerCase()))
  // In the order they'll appear in the results and the file.
  const chosen = columns
    .map((k) => dataset.columns.find((c) => c.key === k))
    .filter((c): c is QueryColumn => !!c)

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.slice(0, 6).map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-800"
          >
            {c.label}
            <button onClick={() => toggle(c.key)} aria-label={`Remove ${c.label}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {chosen.length > 6 && (
          <span className="text-xs text-gray-500">+{chosen.length - 6} more</span>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-purple-700 hover:bg-purple-50"
        >
          <Columns3 className="h-4 w-4" /> {columns.length} of {dataset.columns.length} · Choose
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-2 w-96 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Find a column…"
              className={`${inputCls} flex-1`}
            />
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button
              className="font-medium text-purple-700 hover:underline"
              onClick={() => setColumns(dataset.columns.map((c) => c.key))}
            >
              Select all
            </button>
            <button
              className="font-medium text-purple-700 hover:underline"
              onClick={() => setColumns(defaultColumns(dataset))}
            >
              Reset to default
            </button>
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {shown.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={columns.includes(c.key)}
                  onChange={() => toggle(c.key)}
                  className="accent-purple-700"
                />
                <span className={isInternalId(c) ? 'text-gray-400' : 'text-gray-800'}>
                  {c.label}
                </span>
                {c.encrypted && (
                  <Lock
                    className="h-3 w-3 text-gray-400"
                    aria-label="Stored encrypted — shown decrypted, can't be filtered"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Results and export preview ──────────────────────────────────────────────

function DataTable({ result, dim }: { result: QueryResult; dim?: boolean }) {
  return (
    <div className={`overflow-auto ${dim ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap border-b border-gray-200 px-4 py-2.5 font-semibold ${
                  c.type === 'number' ? 'text-right' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50/60 hover:bg-purple-50/40">
              {result.columns.map((c) => (
                <td
                  key={c.key}
                  title={String(r[c.key] ?? '')}
                  className={`max-w-xs truncate whitespace-nowrap px-4 py-2 text-gray-800 ${
                    c.type === 'number' ? 'text-right tabular-nums' : ''
                  }`}
                >
                  {formatCell(r[c.key], c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Results({
  result,
  offset,
  running,
  stale,
  onPage,
}: {
  result: QueryResult
  offset: number
  running: boolean
  stale: boolean
  onPage: (offset: number) => void
}) {
  const from = result.total ? offset + 1 : 0
  const to = offset + result.rows.length
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Rows3 className="h-4 w-4 text-gray-400" />
          <span className="font-semibold">{result.total.toLocaleString()}</span> row
          {result.total === 1 ? '' : 's'}
          {result.total > 0 && (
            <span className="text-gray-400">
              · showing {from.toLocaleString()}–{to.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || running}
            aria-label="Previous page"
            className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPage(offset + PAGE_SIZE)}
            disabled={to >= result.total || running}
            aria-label="Next page"
            className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {result.rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <Filter className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">No rows match</p>
          <p className="text-xs text-gray-400">
            Loosen or remove a filter and run the query again.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <DataTable result={result} dim={running || stale} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function ExportPreview({
  datasetLabel,
  preview,
  filters,
  sort,
  colLabel,
  exporting,
  onDownload,
  onBack,
}: {
  datasetLabel: string
  preview: { format: ExportFormat; data: QueryResult }
  filters: QueryFilter[]
  sort: Sort
  colLabel: (key: string) => string
  exporting: ExportFormat | null
  onDownload: (f: ExportFormat) => void
  onBack: () => void
}) {
  const { data, format } = preview
  const tooMany = data.total > EXPORT_MAX_ROWS
  const empty = data.total === 0
  const blocked = tooMany || empty
  const isXlsx = format === 'xlsx'

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <button
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </button>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {isXlsx ? (
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            ) : (
              <FileText className="h-5 w-5 text-gray-500" />
            )}
            Export preview
          </h3>
          <p className="text-sm text-gray-500">Check what goes into the file before downloading.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isXlsx && (
            <button
              onClick={() => onDownload('xlsx')}
              disabled={blocked || !!exporting}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Get Excel instead
            </button>
          )}
          {isXlsx && (
            <button
              onClick={() => onDownload('csv')}
              disabled={blocked || !!exporting}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Get CSV instead
            </button>
          )}
          <button
            onClick={() => onDownload(format)}
            disabled={blocked || !!exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Downloading…' : isXlsx ? 'Download Excel' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="space-y-4 bg-gray-50/60 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Dataset" value={datasetLabel} />
          <Stat label="Rows" value={data.total.toLocaleString()} />
          <Stat label="Columns" value={String(data.columns.length)} />
          <Stat label="File" value={isXlsx ? 'Excel · 2 sheets' : 'CSV'} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500">Filters:</span>
          {filters.length ? (
            filters.map((f, i) => (
              <span
                key={i}
                className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-gray-200"
              >
                {colLabel(f.column)} {OP_LABEL[f.op]} <b>{f.value}</b>
              </span>
            ))
          ) : (
            <span className="text-gray-700">none — every row</span>
          )}
          <span className="ml-2 text-gray-500">Sorted by:</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">
            {sort ? `${colLabel(sort.column)} ${sort.dir === 'asc' ? '↑' : '↓'}` : 'default'}
          </span>
        </div>

        {tooMany && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Too many rows to export ({data.total.toLocaleString()}). The limit is{' '}
            {EXPORT_MAX_ROWS.toLocaleString()} — add a filter, such as a date range, and try again.
          </p>
        )}
        {empty && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No rows match, so the file would be empty. Adjust the filters first.
          </p>
        )}

        {!empty && (
          <div className={`${card} overflow-hidden`}>
            <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
              First {Math.min(data.rows.length, data.total)} of {data.total.toLocaleString()} rows,
              as they will appear in the file
            </div>
            <div className="max-h-80 overflow-auto">
              <DataTable result={data} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
