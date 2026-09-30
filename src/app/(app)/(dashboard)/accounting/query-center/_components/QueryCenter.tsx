'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Database,
  Download,
  Lock,
  Play,
  Plus,
  Search,
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

const PAGE_SIZE = 100

const OPS: { op: FilterOp; label: string; types: QueryColumn['type'][]; noValue?: boolean }[] = [
  { op: 'eq', label: 'is', types: ['string', 'number', 'date', 'enum', 'boolean'] },
  { op: 'neq', label: 'is not', types: ['string', 'number', 'enum', 'boolean'] },
  { op: 'contains', label: 'contains', types: ['string'] },
  { op: 'startsWith', label: 'starts with', types: ['string'] },
  { op: 'gte', label: '≥ / on or after', types: ['number', 'date'] },
  { op: 'lte', label: '≤ / on or before', types: ['number', 'date'] },
  { op: 'gt', label: '>', types: ['number', 'date'] },
  { op: 'lt', label: '<', types: ['number', 'date'] },
  { op: 'in', label: 'is one of (a, b, …)', types: ['string', 'number', 'enum'] },
  { op: 'isEmpty', label: 'is empty', types: ['string', 'number', 'date', 'enum'], noValue: true },
  {
    op: 'isNotEmpty',
    label: 'is not empty',
    types: ['string', 'number', 'date', 'enum'],
    noValue: true,
  },
]

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

// Scenario 62 — the Data Query Center: pick a dataset (any table in any
// module), choose columns, filter, sort, preview, export. Read-only by
// construction; the backend only ever runs findMany/count against a
// whitelisted column set, scoped to the owner's business.
export default function QueryCenter() {
  const [datasets, setDatasets] = useState<QueryDataset[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dataset, setDataset] = useState<QueryDataset | null>(null)

  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [sort, setSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null)
  const [showColumns, setShowColumns] = useState(false)

  const [result, setResult] = useState<QueryResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)

  useEffect(() => {
    QueryCenterApi.datasets().then((res) => {
      if (res.success && res.data) setDatasets(res.data)
      else setLoadError(res.message || res.error || 'Could not load datasets.')
    })
  }, [])

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const map = new Map<string, QueryDataset[]>()
    for (const d of datasets) {
      if (term && !`${d.label} ${d.module} ${d.key}`.toLowerCase().includes(term)) continue
      map.set(d.module, [...(map.get(d.module) ?? []), d])
    }
    return [...map.entries()]
  }, [datasets, search])

  const query = (nextOffset: number): DatasetQuery => ({
    columns,
    filters: filters.filter((f) => f.column),
    sort: sort ?? undefined,
    limit: PAGE_SIZE,
    offset: nextOffset,
  })

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
  }

  const pick = (d: QueryDataset) => {
    const defaults = d.columns.filter((c) => !c.isForeignKey).map((c) => c.key)
    setDataset(d)
    setColumns(defaults)
    setFilters([])
    setSort(d.defaultSort)
    setResult(null)
    setShowColumns(false)
    run(d, 0, { columns: defaults, sort: d.defaultSort ?? undefined, limit: PAGE_SIZE })
  }

  const colByKey = (key: string) => dataset?.columns.find((c) => c.key === key)
  const queryable = dataset?.columns.filter((c) => c.queryable) ?? []

  const updateFilter = (i: number, patch: Partial<QueryFilter>) =>
    setFilters((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  const doExport = async (format: 'xlsx' | 'csv') => {
    if (!dataset) return
    setExporting(format)
    await QueryCenterApi.export(dataset.key, query(0), format)
    setExporting(null)
  }

  const toggleColumn = (key: string) =>
    setColumns((cs) =>
      cs.includes(key)
        ? cs.filter((c) => c !== key)
        : dataset!.columns.map((c) => c.key).filter((k) => k === key || cs.includes(k))
    )

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)]">
      {/* Dataset picker */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Database className="h-5 w-5 text-purple-700" /> Data Query Center
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only raw data from every module. {datasets.length} datasets.
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a dataset…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadError && <p className="p-2 text-xs text-red-600">{loadError}</p>}
          {grouped.map(([module, items]) => (
            <div key={module} className="mb-3">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {module}
              </div>
              {items.map((d) => (
                <button
                  key={d.key}
                  onClick={() => pick(d)}
                  className={`block w-full text-left px-2 py-1.5 text-sm rounded-md ${
                    dataset?.key === d.key
                      ? 'bg-purple-50 text-purple-800 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Query + results */}
      <section className="flex-1 min-w-0 p-6">
        {!dataset ? (
          <div className="flex h-full items-center justify-center text-center text-gray-400">
            <div>
              <Database className="mx-auto mb-3 h-10 w-10" />
              <p className="text-sm">Pick a dataset on the left to start.</p>
              <p className="mt-1 text-xs">
                Every table is here — journal entries, GL lines, invoices, POS sales, stock
                movements, and more — ready to filter and export to Excel or CSV.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">{dataset.module}</div>
                <h1 className="text-2xl font-semibold text-gray-900">{dataset.label}</h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => doExport('xlsx')}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-gray-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
                </button>
                <button
                  onClick={() => doExport('csv')}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-gray-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting === 'csv' ? 'Exporting…' : 'CSV'}
                </button>
              </div>
            </div>

            {/* Builder */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs font-semibold uppercase text-gray-500">Select</span>
                <div className="relative">
                  <button
                    onClick={() => setShowColumns((v) => !v)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <Columns3 className="h-4 w-4" />
                    {columns.length} of {dataset.columns.length} columns
                  </button>
                  {showColumns && (
                    <div className="absolute z-20 mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <div className="mb-1 flex justify-between px-1 text-xs">
                        <button
                          className="text-purple-700 hover:underline"
                          onClick={() => setColumns(dataset.columns.map((c) => c.key))}
                        >
                          All
                        </button>
                        <button
                          className="text-purple-700 hover:underline"
                          onClick={() =>
                            setColumns(
                              dataset.columns.filter((c) => !c.isForeignKey).map((c) => c.key)
                            )
                          }
                        >
                          Default (hide IDs)
                        </button>
                      </div>
                      {dataset.columns.map((c) => (
                        <label
                          key={c.key}
                          className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={columns.includes(c.key)}
                            onChange={() => toggleColumn(c.key)}
                          />
                          <span className={c.isForeignKey ? 'text-gray-400' : ''}>{c.label}</span>
                          {c.encrypted && (
                            <Lock
                              className="h-3 w-3 text-gray-400"
                              aria-label="Stored encrypted — shown decrypted, can't be filtered"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-2">
                <span className="w-16 pt-1.5 text-xs font-semibold uppercase text-gray-500">
                  Where
                </span>
                <div className="flex-1 space-y-2">
                  {filters.map((f, i) => {
                    const col = colByKey(f.column)
                    const ops = OPS.filter((o) => !col || o.types.includes(col.type))
                    const noValue = OPS.find((o) => o.op === f.op)?.noValue
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        {i > 0 && <span className="text-xs text-gray-400">and</span>}
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
                          className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                        >
                          <option value="">— column —</option>
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
                          className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                        >
                          {ops.map((o) => (
                            <option key={o.op} value={o.op}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {!noValue &&
                          (col?.type === 'enum' && f.op !== 'in' ? (
                            <select
                              aria-label="Filter value"
                              value={f.value ?? ''}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                            >
                              <option value="">—</option>
                              {col.enumValues?.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          ) : col?.type === 'boolean' ? (
                            <select
                              aria-label="Filter value"
                              value={f.value ?? ''}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                            >
                              <option value="">—</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              aria-label="Filter value"
                              type={
                                col?.type === 'date'
                                  ? 'date'
                                  : col?.type === 'number' && f.op !== 'in'
                                    ? 'number'
                                    : 'text'
                              }
                              value={f.value ?? ''}
                              onChange={(e) => updateFilter(i, { value: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && run()}
                              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                            />
                          ))}
                        <button
                          onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}
                          aria-label="Remove filter"
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                  <button
                    onClick={() => setFilters((fs) => [...fs, { column: '', op: 'eq', value: '' }])}
                    className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"
                  >
                    <Plus className="h-4 w-4" /> Add filter
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs font-semibold uppercase text-gray-500">Order by</span>
                <select
                  aria-label="Sort column"
                  value={sort?.column ?? ''}
                  onChange={(e) =>
                    setSort(
                      e.target.value ? { column: e.target.value, dir: sort?.dir ?? 'asc' } : null
                    )
                  }
                  className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">— none —</option>
                  {queryable.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {sort && (
                  <select
                    aria-label="Sort direction"
                    value={sort.dir}
                    onChange={(e) => setSort({ ...sort, dir: e.target.value as 'asc' | 'desc' })}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                )}
                <button
                  onClick={() => run()}
                  disabled={running || columns.length === 0}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" /> {running ? 'Running…' : 'Run query'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {result.total.toLocaleString()} row{result.total === 1 ? '' : 's'}
                    {result.total > 0 &&
                      ` · showing ${(offset + 1).toLocaleString()}–${(offset + result.rows.length).toLocaleString()}`}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => run(dataset, Math.max(0, offset - PAGE_SIZE))}
                      disabled={offset === 0 || running}
                      aria-label="Previous page"
                      className="p-1.5 border border-gray-200 rounded-md disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => run(dataset, offset + PAGE_SIZE)}
                      disabled={offset + PAGE_SIZE >= result.total || running}
                      aria-label="Next page"
                      className="p-1.5 border border-gray-200 rounded-md disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-auto rounded-lg border border-gray-200 bg-white max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        {result.columns.map((c) => (
                          <th
                            key={c.key}
                            className={`px-3 py-2 whitespace-nowrap ${c.type === 'number' ? 'text-right' : 'text-left'}`}
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={result.columns.length}
                            className="px-3 py-8 text-center text-gray-400"
                          >
                            No rows match.
                          </td>
                        </tr>
                      ) : (
                        result.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {result.columns.map((c) => (
                              <td
                                key={c.key}
                                className={`px-3 py-1.5 whitespace-nowrap max-w-xs truncate ${c.type === 'number' ? 'text-right tabular-nums' : ''}`}
                                title={String(r[c.key] ?? '')}
                              >
                                {formatCell(r[c.key], c)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Exports include every matching row (up to 100,000), with the columns, filters and
                  order shown here.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
