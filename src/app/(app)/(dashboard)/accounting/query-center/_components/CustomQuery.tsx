'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { FileSpreadsheet, Play, Plus, SlidersHorizontal, X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import {
  MULTI_DATASET_KEY,
  QueryCenter as QueryCenterApi,
  type DatasetQuery,
  type MultiQuery,
  type QueryBlock,
  type QueryDataset,
  type QueryFilter,
  type QueryResult,
  type SavedReport,
  type SummaryGroup,
  type SummaryQuery,
  type SummaryResult,
  type SummarySort,
} from '@/src/libs/data/QueryCenterData'
import {
  GroupRows,
  PAGE_SIZE,
  QueryBuilder,
  Results,
  card,
  defaultColumns,
  friendlyName,
} from './QueryCenter'
import {
  GroupByField,
  SaveReportControl,
  SummaryResults,
  groupFilters,
  groupedQuery,
} from './ReportBuilder'

// The Custom query: several datasets on one page, each section with its own
// columns, filters, Group by and sort. "Run all" runs every section; Save
// keeps them together as one report; Excel puts each section on its own sheet.

const MAX_SECTIONS = 8

type Sort = { column: string; dir: 'asc' | 'desc' } | null

interface Section {
  uid: number
  initial?: QueryBlock
}

/** What a section saves (its rows query, Group by included) and what it
 * exports (a grouped section runs as a summary). */
interface SectionQuery {
  saved: QueryBlock
  exported: QueryBlock
}

let nextUid = 1
const newSection = (initial?: QueryBlock): Section => ({ uid: nextUid++, initial })

export default function CustomQuery({
  datasets,
  report,
  onSaved,
}: {
  datasets: QueryDataset[]
  /** A saved Custom query to open, or null for a new one. */
  report: SavedReport | null
  onSaved: (r: SavedReport, isNew: boolean) => void
}): ReactElement {
  const [sections, setSections] = useState<Section[]>(() => {
    const blocks = (report?.definition as MultiQuery | undefined)?.blocks
    return blocks?.length ? blocks.map((b) => newSection(b)) : [newSection()]
  })
  // Each section reports its current query here (null until it can run).
  const defs = useRef(new Map<number, SectionQuery | null>())
  const [runToken, setRunToken] = useState(report ? 1 : 0)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const readyBlocks = (which: keyof SectionQuery): QueryBlock[] =>
    sections.map((s) => defs.current.get(s.uid)?.[which]).filter((b): b is QueryBlock => !!b)

  /** Chloe's review: a half-filled section is never silently left out of a
   * save, an update or an export — the user is told which one and nothing
   * is saved until it's finished or removed. */
  const unfinishedMessage = (): string | null => {
    const numbers = sections
      .map((s, i) => (defs.current.get(s.uid) ? null : i + 1))
      .filter((n): n is number => n !== null)
    if (!numbers.length) return null
    const which =
      numbers.length === 1
        ? `Section ${numbers[0]} isn't finished`
        : `Sections ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)} aren't finished`
    return `${which} — pick its data, at least one column, and a column for every Group by. Finish it or remove it (✕), then try again.`
  }

  const save = async (name: string): Promise<void> => {
    const problem = unfinishedMessage()
    if (problem) return setMessage({ ok: false, text: problem })
    const blocks = readyBlocks('saved')
    setSaving(true)
    const res = await QueryCenterApi.reports.save({
      name,
      datasetKey: MULTI_DATASET_KEY,
      kind: 'multi',
      definition: { blocks },
    })
    setSaving(false)
    if (!res.success || !res.data) {
      return setMessage({ ok: false, text: res.message || res.error || 'Could not save.' })
    }
    onSaved(res.data, true)
    setMessage({ ok: true, text: `Saved as “${res.data.name}”.` })
  }

  const update = async (): Promise<void> => {
    if (!report) return
    const problem = unfinishedMessage()
    if (problem) return setMessage({ ok: false, text: problem })
    setSaving(true)
    const res = await QueryCenterApi.reports.update(report.id, {
      definition: { blocks: readyBlocks('saved') },
    })
    setSaving(false)
    if (!res.success || !res.data) {
      return setMessage({ ok: false, text: res.message || res.error || 'Could not update.' })
    }
    onSaved(res.data, false)
    setMessage({ ok: true, text: `Updated “${res.data.name}”.` })
  }

  const exportAll = async (): Promise<void> => {
    const problem = unfinishedMessage()
    if (problem) return setMessage({ ok: false, text: problem })
    const blocks = readyBlocks('exported')
    setExporting(true)
    await QueryCenterApi.exportMulti(report?.name ?? 'Custom query', blocks)
    setExporting(false)
  }

  const remove = (uid: number): void => {
    defs.current.delete(uid)
    setSections((ss) => ss.filter((s) => s.uid !== uid))
  }

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3 p-5`}>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-prominent-purple-900">
            <SlidersHorizontal className="h-5 w-5 text-purple-700" />
            {report?.name ?? 'Custom query'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Put several datasets on one page — each section has its own columns, filters, Group by
            and sort. Save keeps every section together; Excel gives each its own sheet.
          </p>
        </div>
        <button
          onClick={exportAll}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          {exporting ? 'Preparing…' : 'Excel (all sections)'}
        </button>
        <button
          onClick={() => setRunToken((t) => t + 1)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-700 px-4 text-sm font-medium text-white hover:bg-purple-800"
        >
          <Play className="h-4 w-4" /> Run all
        </button>
      </div>

      {sections.map((s, i) => (
        <QuerySection
          key={s.uid}
          index={i}
          datasets={datasets}
          initial={s.initial}
          runToken={runToken}
          canRemove={sections.length > 1}
          onRemove={() => remove(s.uid)}
          onChange={(q) => {
            defs.current.set(s.uid, q)
          }}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSections((ss) => [...ss, newSection()])}
          disabled={sections.length >= MAX_SECTIONS}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-purple-300 px-3 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add dataset
        </button>
        <span className="text-xs text-gray-400">
          {sections.length} of {MAX_SECTIONS} sections
        </span>
        <div className="ml-auto">
          <SaveReportControl
            activeName={report?.name ?? null}
            saving={saving}
            onSave={save}
            onUpdate={update}
          />
        </div>
      </div>
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

// ─── One section ────────────────────────────────────────────────────────────

function QuerySection({
  index,
  datasets,
  initial,
  runToken,
  canRemove,
  onRemove,
  onChange,
}: {
  index: number
  datasets: QueryDataset[]
  initial?: QueryBlock
  runToken: number
  canRemove: boolean
  onRemove: () => void
  onChange: (q: SectionQuery | null) => void
}): ReactElement {
  const startDataset = datasets.find((d) => d.key === initial?.datasetKey) ?? null
  const def = initial?.definition as (DatasetQuery & Partial<SummaryQuery>) | undefined
  const rowsDef = initial?.kind === 'rows' ? def : undefined

  const [dataset, setDataset] = useState<QueryDataset | null>(startDataset)
  const [columns, setColumns] = useState<string[]>(
    rowsDef?.columns?.length ? rowsDef.columns : startDataset ? defaultColumns(startDataset) : []
  )
  const [filters, setFilters] = useState<QueryFilter[]>(def?.filters ?? [])
  const [sort, setSort] = useState<Sort>(rowsDef?.sort ?? startDataset?.defaultSort ?? null)
  const [groupBy, setGroupBy] = useState<SummaryGroup[]>(def?.groupBy ?? [])
  // A click on a grouped result's column header; otherwise "Sort by" applies.
  const [summarySort, setSummarySort] = useState<SummarySort | null>(null)

  const [result, setResult] = useState<QueryResult | null>(null)
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState('')

  const activeFilters = filters.filter((f) => f.column)
  const grouped = groupBy.length > 0
  const rowsQuery: DatasetQuery = { columns, filters: activeFilters, sort: sort ?? undefined }
  const summaryQuery = (override: SummarySort | null = summarySort): SummaryQuery | null =>
    dataset
      ? groupedQuery(dataset, { columns, filters: activeFilters, sort, groupBy }, override)
      : null
  const current = grouped ? summaryQuery() : rowsQuery
  const signature = JSON.stringify({ grouped, current })
  const canRun = columns.length > 0 && groupBy.every((g) => !!g.column)

  // Tell the page what this section would save / export.
  useEffect(() => {
    if (!dataset || !canRun || !current) {
      onChange(null)
      return
    }
    onChange({
      saved: {
        datasetKey: dataset.key,
        kind: 'rows',
        definition: { ...rowsQuery, ...(grouped ? { groupBy } : {}) },
      },
      exported: {
        datasetKey: dataset.key,
        kind: grouped ? 'summary' : 'rows',
        definition: current,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, signature, canRun])

  const run = async (nextOffset = 0, sortOverride?: SummarySort): Promise<void> => {
    const sq = summaryQuery(sortOverride ?? summarySort)
    if (!dataset || !canRun || !sq) return
    setRunning(true)
    setError(null)
    const res = grouped
      ? await QueryCenterApi.summary(dataset.key, sq)
      : await QueryCenterApi.preview(dataset.key, {
          ...rowsQuery,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })
    setRunning(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'The query failed.')
      return
    }
    if (grouped) {
      setSummaryResult(res.data as SummaryResult)
    } else {
      setResult(res.data as QueryResult)
      setOffset(nextOffset)
    }
    setLastRun(signature)
  }

  // "Run all" on the page (and a saved query's sections when it opens).
  const firstToken = useRef(runToken)
  useEffect(() => {
    if (runToken === 0 || (runToken === firstToken.current && !initial)) return
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken])

  const pick = (d: QueryDataset): void => {
    setDataset(d)
    setColumns(defaultColumns(d))
    setFilters([])
    setSort(d.defaultSort ?? null)
    setGroupBy([])
    setSummarySort(null)
    setResult(null)
    setSummaryResult(null)
    setError(null)
  }

  const stale = lastRun !== '' && lastRun !== signature

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-purple-50/40 px-5 py-3">
        <span className="rounded-full bg-purple-700 px-2.5 py-0.5 text-xs font-semibold text-white">
          {index + 1}
        </span>
        <DatasetSelect datasets={datasets} value={dataset} onPick={pick} />
        {dataset && <span className="text-xs text-gray-500">{dataset.module}</span>}
        {canRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove section ${index + 1}`}
            className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!dataset ? (
        <p className="px-5 py-6 text-sm text-gray-400">
          Choose the data for this section — any of {datasets.length} datasets.
        </p>
      ) : (
        <div className="space-y-4 p-4">
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
            onRun={() => void run()}
            canRun={canRun}
            groupByField={
              <GroupByField
                dataset={dataset}
                groupBy={groupBy}
                setGroupBy={(g) => {
                  setGroupBy(g)
                  setSummarySort(null)
                }}
              />
            }
            actions={null}
          />
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {grouped
            ? summaryResult && (
                <SummaryResults
                  result={summaryResult}
                  sort={summaryQuery()?.sort ?? null}
                  renderDetail={(row) => (
                    <GroupRows
                      dataset={dataset}
                      query={{ columns, filters: activeFilters, sort }}
                      groupFilter={groupFilters(dataset, summaryResult, row)}
                    />
                  )}
                  onSort={(s) => {
                    setSummarySort(s)
                    void run(0, s)
                  }}
                  dim={running || stale}
                />
              )
            : result && (
                <Results
                  result={result}
                  offset={offset}
                  running={running}
                  stale={stale}
                  onPage={(o) => void run(o)}
                />
              )}
        </div>
      )}
    </section>
  )
}

/** Every dataset in one dropdown, grouped by module. */
function DatasetSelect({
  datasets,
  value,
  onPick,
}: {
  datasets: QueryDataset[]
  value: QueryDataset | null
  onPick: (d: QueryDataset) => void
}): ReactElement {
  // Grouped by module and searchable — 231 datasets is a list nobody scrolls.
  const options = useMemo(
    () =>
      [...datasets]
        .sort((a, b) => a.module.localeCompare(b.module))
        .map((d) => ({ value: d.key, label: friendlyName(d), group: d.module })),
    [datasets]
  )
  return (
    <div className="min-w-72">
      <SearchableSelect
        portal
        ariaLabel="Data for this section"
        placeholder="Choose data…"
        value={value?.key ?? ''}
        onChange={(key) => {
          const d = datasets.find((x) => x.key === key)
          if (d) onPick(d)
        }}
        options={options}
      />
    </div>
  )
}
