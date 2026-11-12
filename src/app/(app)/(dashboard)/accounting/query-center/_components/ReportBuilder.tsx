'use client'

import { Fragment, useState, type ReactElement, type ReactNode } from 'react'
import { BarChart3, Bookmark, ChevronRight, Layers, Plus, Trash2, X } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type {
  DateBucket,
  QueryColumn,
  QueryDataset,
  QueryFilter,
  SavedReport,
  SummaryGroup,
  SummaryMeasure,
  SummaryQuery,
  SummaryResult,
  SummarySort,
} from '@/src/libs/data/QueryCenterData'

// The report builder half of the Data Query Center: instead of listing rows,
// group a dataset by up to three columns and total it — "sales per branch per
// month" — then save it under a name to run again. Same filters and the same
// business scoping as a row query; the backend does the grouping.

export const MAX_GROUPS = 3

const BUCKETS: { bucket: DateBucket; label: string }[] = [
  { bucket: 'day', label: 'by day' },
  { bucket: 'month', label: 'by month' },
  { bucket: 'year', label: 'by year' },
]

const inputCls =
  'h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'
const card = 'rounded-xl border border-gray-200 bg-white shadow-sm'

function SectionRow({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[9rem_1fr] md:gap-4">
      <div className="flex items-center gap-2 pt-1.5 text-sm font-medium text-gray-700 md:items-start">
        {icon} {title}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-600"
    >
      <X className="h-4 w-4" />
    </button>
  )
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}): ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-40"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  )
}

function GroupByRows({
  dataset,
  groupBy,
  setGroupBy,
}: {
  dataset: QueryDataset
  groupBy: SummaryGroup[]
  setGroupBy: (g: SummaryGroup[]) => void
}): ReactElement {
  const colByKey = (key: string): QueryColumn | undefined =>
    dataset.columns.find((c) => c.key === key)
  const update = (i: number, patch: Partial<SummaryGroup>): void =>
    setGroupBy(groupBy.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  return (
    <div className="space-y-2">
      {groupBy.length === 0 && (
        <p className="pt-1.5 text-sm text-gray-400">
          Nothing — every row is listed. Add a column (customer, branch, month…) to combine the rows
          that share it into one line.
        </p>
      )}
      {groupBy.map((g, i) => {
        const col = colByKey(g.column)
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
            {/* Searchable, like the rest of the app's long dropdowns. */}
            <div className="min-w-56">
              <SearchableSelect
                portal
                ariaLabel={`Group by column ${i + 1}`}
                placeholder="Choose a column…"
                value={g.column}
                onChange={(value) => {
                  const next = colByKey(value)
                  update(i, {
                    column: value,
                    bucket: next?.type === 'date' ? 'month' : undefined,
                  })
                }}
                options={dataset.columns.map((c) => ({ value: c.key, label: c.label }))}
              />
            </div>
            {col?.type === 'date' && (
              <div className="min-w-36">
                <SearchableSelect
                  portal
                  ariaLabel={`Group ${col.label} by`}
                  value={g.bucket ?? 'month'}
                  onChange={(value) => update(i, { bucket: value as DateBucket })}
                  options={BUCKETS.map((b) => ({ value: b.bucket, label: b.label }))}
                />
              </div>
            )}
            <RemoveButton
              label="Remove group column"
              onClick={() => setGroupBy(groupBy.filter((_, j) => j !== i))}
            />
          </div>
        )
      })}
      <AddButton
        label="Add group column"
        disabled={groupBy.length >= MAX_GROUPS}
        onClick={() => setGroupBy([...groupBy, { column: '' }])}
      />
    </div>
  )
}

/** Group by, inside Rows: combines the rows that share a value into one line. */
export function GroupByField({
  dataset,
  groupBy,
  setGroupBy,
}: {
  dataset: QueryDataset
  groupBy: SummaryGroup[]
  setGroupBy: (g: SummaryGroup[]) => void
}): ReactElement {
  return (
    <SectionRow icon={<Layers className="h-4 w-4 text-gray-400" />} title="Group by">
      <GroupByRows dataset={dataset} groupBy={groupBy} setGroupBy={setGroupBy} />
      {groupBy.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Each line shows how many rows it combines and adds up the number columns. Other columns
          show their value when all the combined rows share it, or “(several)” when they don’t.
        </p>
      )}
    </SectionRow>
  )
}

/** A rows query with Group by: what the grouped query totals. */
export interface GroupedRowsQuery {
  columns: string[]
  filters: QueryFilter[]
  sort: { column: string; dir: 'asc' | 'desc' } | null
  groupBy: SummaryGroup[]
}

/** The totals of a grouped rows query: a count, then every picked column
 * that isn't itself a group column — a number summed, anything else shown
 * when the combined rows agree ("(several)" when they don't). */
export function groupedMeasures(
  dataset: QueryDataset,
  columns: string[],
  groupBy: SummaryGroup[]
): SummaryMeasure[] {
  const grouped = new Set(groupBy.map((g) => g.column))
  const rest = columns.filter((k) => !grouped.has(k))
  const isNumber = (k: string): boolean =>
    dataset.columns.find((c) => c.key === k)?.type === 'number'
  return [
    { fn: 'count' },
    ...rest.map((column) => ({
      fn: isNumber(column) ? ('sum' as const) : ('same' as const),
      column,
    })),
  ]
}

/** A rows query with Group by, as the summary it runs as. "Sort by" carries
 * over when it names a group column or a summed column; a header click
 * (`override`) wins. */
export function groupedQuery(
  dataset: QueryDataset,
  q: GroupedRowsQuery,
  override?: SummarySort | null
): SummaryQuery {
  const measures = groupedMeasures(dataset, q.columns, q.groupBy)
  const fits = (s: SummarySort): boolean =>
    s.index < (s.by === 'group' ? q.groupBy : measures).length
  const g = q.sort ? q.groupBy.findIndex((x) => x.column === q.sort?.column) : -1
  const m = q.sort ? measures.findIndex((x) => x.column === q.sort?.column) : -1
  const fromSort: SummarySort | undefined =
    q.sort && g >= 0
      ? { by: 'group', index: g, dir: q.sort.dir }
      : q.sort && m >= 0
        ? { by: 'measure', index: m, dir: q.sort.dir }
        : undefined
  return {
    filters: q.filters,
    groupBy: q.groupBy,
    measures,
    sort: override && fits(override) ? override : fromSort,
  }
}

// ─── Results ─────────────────────────────────────────────────────────────────

/** A grouped line's text/date column whose combined rows disagree. */
const SEVERAL = '(several)'

function formatValue(v: unknown, type: QueryColumn['type'], isBucket = false): string {
  if (v === null || v === undefined || v === '') return '(blank)'
  if (v === SEVERAL) return SEVERAL
  if (type === 'number' && typeof v === 'number')
    return v.toLocaleString('en-PH', { maximumFractionDigits: 2 })
  if (type === 'date' && !isBucket) return String(v).slice(0, 10)
  if (type === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function SortableHeader({
  label,
  numeric,
  active,
  onClick,
}: {
  label: string
  numeric: boolean
  active: 'asc' | 'desc' | null
  onClick: () => void
}): ReactElement {
  return (
    <th
      className={`whitespace-nowrap border-b border-gray-200 px-4 py-2.5 font-semibold ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-purple-700">
        {label}
        {active && <span aria-hidden>{active === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

type SummaryRow = SummaryResult['rows'][number]

/** Manila midnight at the start of a day/month/year bucket, and the next. */
function bucketRange(key: string, bucket: DateBucket): [string, string] {
  const [y, m = 1, day = 1] = key.split('-').map(Number)
  const next =
    bucket === 'year'
      ? [y + 1, 1, 1]
      : bucket === 'month'
        ? [m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1]
        : (() => {
            const t = new Date(Date.UTC(y, m - 1, day + 1))
            return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]
          })()
  const iso = (p: number[]): string =>
    `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}T00:00:00+08:00`
  return [iso([y, m, day]), iso(next)]
}

/**
 * The filters that pick out exactly the rows one grouped line combines — a
 * related record by its id, a month by its Manila date range, a blank by "is
 * empty". Null when a group column can't be filtered on (stored encrypted).
 */
export function groupFilters(
  dataset: QueryDataset,
  result: SummaryResult,
  row: SummaryRow
): QueryFilter[] | null {
  const queryable = (key: string): boolean =>
    !!dataset.columns.find((c) => c.key === key)?.queryable
  const out: QueryFilter[] = []
  for (const [j, g] of result.groups.entries()) {
    const key = row.keys[j]
    const id = row.ids?.[j]
    if (g.idKey && id !== undefined && queryable(g.idKey)) {
      out.push(
        id === null
          ? { column: g.key, op: 'isEmpty' }
          : { column: g.idKey, op: 'eq', value: String(id) }
      )
      continue
    }
    if (!queryable(g.key)) return null
    if (key === null) {
      out.push({ column: g.key, op: 'isEmpty' })
    } else if (g.bucket) {
      const [from, to] = bucketRange(String(key), g.bucket)
      out.push({ column: g.key, op: 'gte', value: from }, { column: g.key, op: 'lt', value: to })
    } else {
      out.push({ column: g.key, op: 'eq', value: String(key) })
    }
  }
  return out
}

export function SummaryResults({
  result,
  sort,
  onSort,
  dim,
  renderDetail,
}: {
  result: SummaryResult
  sort: SummarySort | null
  onSort: (s: SummarySort) => void
  dim: boolean
  /** The rows behind a line, shown under it when it's clicked. */
  renderDetail?: (row: SummaryRow) => ReactNode
}): ReactElement {
  // Which line is open — reset whenever a new result arrives.
  const [open, setOpen] = useState<{ result: SummaryResult; index: number } | null>(null)
  const openIndex = open?.result === result ? open.index : null
  const width = result.groups.length + result.measures.length
  const activeDir = (by: SummarySort['by'], index: number): 'asc' | 'desc' | null =>
    sort && sort.by === by && sort.index === index ? sort.dir : null
  const toggle = (by: SummarySort['by'], index: number): void =>
    onSort({ by, index, dir: activeDir(by, index) === 'desc' ? 'asc' : 'desc' })
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <span className="font-semibold">{result.groupCount.toLocaleString()}</span>
          {result.groups.length ? ' groups' : ' total'}
          <span className="text-gray-400">
            · from {result.sourceRows.toLocaleString()} row{result.sourceRows === 1 ? '' : 's'}
          </span>
        </div>
        {result.truncated && (
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            Showing the first {result.rows.length.toLocaleString()} groups — export to get all of
            them.
          </span>
        )}
      </div>
      <div className={`max-h-[60vh] overflow-auto ${dim ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {result.groups.map((g, i) => (
                <SortableHeader
                  key={`g${i}`}
                  label={g.label}
                  numeric={false}
                  active={activeDir('group', i)}
                  onClick={() => toggle('group', i)}
                />
              ))}
              {result.measures.map((m, i) => (
                <SortableHeader
                  key={`m${i}`}
                  label={m.label}
                  numeric={m.type === 'number'}
                  active={activeDir('measure', i)}
                  onClick={() => toggle('measure', i)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <Fragment key={i}>
                <tr
                  onClick={
                    renderDetail
                      ? () => setOpen(openIndex === i ? null : { result, index: i })
                      : undefined
                  }
                  title={renderDetail ? 'Show the rows in this line' : undefined}
                  className={`odd:bg-white even:bg-gray-50/60 hover:bg-purple-50/40 ${
                    renderDetail ? 'cursor-pointer' : ''
                  } ${openIndex === i ? '!bg-purple-50' : ''}`}
                >
                  {r.keys.map((k, j) => (
                    <td
                      key={`g${j}`}
                      className={`whitespace-nowrap px-4 py-2 ${k === null ? 'italic text-gray-400' : 'text-gray-800'}`}
                    >
                      {renderDetail && j === 0 && (
                        <ChevronRight
                          className={`mr-1 inline h-3.5 w-3.5 text-gray-400 transition-transform ${
                            openIndex === i ? 'rotate-90' : ''
                          }`}
                        />
                      )}
                      {formatValue(k, result.groups[j].type, !!result.groups[j].bucket)}
                    </td>
                  ))}
                  {r.values.map((v, j) => (
                    <td
                      key={`m${j}`}
                      className={`whitespace-nowrap px-4 py-2 text-gray-800 ${
                        result.measures[j].type === 'number' ? 'text-right tabular-nums' : ''
                      }`}
                    >
                      {formatValue(v, result.measures[j].type)}
                    </td>
                  ))}
                </tr>
                {renderDetail && openIndex === i && (
                  <tr>
                    <td colSpan={width} className="bg-purple-50/40 px-4 py-3">
                      {renderDetail(r)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {result.groups.length > 0 && (
            <tfoot className="sticky bottom-0 bg-purple-50 font-semibold text-gray-900">
              <tr>
                <td
                  colSpan={result.groups.length}
                  className="border-t border-purple-100 px-4 py-2.5"
                >
                  Total
                </td>
                {result.totals.map((v, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap border-t border-purple-100 px-4 py-2.5 ${
                      result.measures[j].type === 'number' ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {formatValue(v, result.measures[j].type)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── Saved reports ───────────────────────────────────────────────────────────

export function SavedReportsList({
  reports,
  activeId,
  datasetLabel,
  onOpen,
  onDelete,
}: {
  reports: SavedReport[]
  activeId: string | null
  datasetLabel: (key: string) => string
  onOpen: (r: SavedReport) => void
  onDelete: (r: SavedReport) => void
}): ReactElement | null {
  // Chloe's review: confirm on the page, not with the browser's pop-up.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  if (reports.length === 0) return null
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
        <Bookmark className="h-3.5 w-3.5" /> Saved reports
      </div>
      {reports.map((r) =>
        confirmingId === r.id ? (
          <div
            key={r.id}
            role="alertdialog"
            aria-label={`Delete saved report ${r.name}?`}
            className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-red-800">
              Delete “{r.name}”? It can&rsquo;t be undone.
            </span>
            <button
              onClick={() => {
                setConfirmingId(null)
                onDelete(r)
              }}
              className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmingId(null)}
              className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-white"
            >
              Keep
            </button>
          </div>
        ) : (
          <div
            key={r.id}
            className={`group flex items-center rounded-md ${
              activeId === r.id ? 'bg-purple-100' : 'hover:bg-gray-100'
            }`}
          >
            <button
              onClick={() => onOpen(r)}
              className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
              title={`${r.name} — ${datasetLabel(r.datasetKey)}`}
            >
              <span
                className={`block truncate text-sm ${
                  activeId === r.id ? 'font-medium text-purple-800' : 'text-gray-700'
                }`}
              >
                {r.name}
              </span>
              <span className="block truncate text-[11px] text-gray-400">
                {r.kind === 'multi' ? 'Custom query' : r.kind === 'summary' ? 'Summary' : 'Rows'}
                {r.kind !== 'multi' && ` · ${datasetLabel(r.datasetKey)}`}
              </span>
            </button>
            <button
              onClick={() => setConfirmingId(r.id)}
              aria-label={`Delete saved report ${r.name}`}
              className="mr-1 rounded p-1 text-gray-300 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}
    </div>
  )
}

/** Save the query on screen under a name — or, when it was opened from a saved
 * report, update that one in place. */
export function SaveReportControl({
  activeName,
  saving,
  onSave,
  onUpdate,
}: {
  activeName: string | null
  saving: boolean
  onSave: (name: string) => void
  onUpdate: () => void
}): ReactElement {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  if (naming) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onSave(name.trim())
          setNaming(false)
          setName('')
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="save-report-name" className="sr-only">
          Report name
        </label>
        <input
          id="save-report-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Monthly sales by branch"
          maxLength={150}
          aria-invalid={name.length > 0 && !name.trim()}
          className={`${inputCls} w-64`}
        />
        {name.length > 0 && !name.trim() && (
          <span className="text-xs text-red-600">Please enter a name.</span>
        )}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setNaming(false)}
          className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </form>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {activeName && (
        <button
          onClick={onUpdate}
          disabled={saving}
          title={`Overwrite "${activeName}" with the query on screen`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-purple-300 hover:text-purple-800 disabled:opacity-50"
        >
          Update “{activeName}”
        </button>
      )}
      <button
        onClick={() => setNaming(true)}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-purple-300 hover:text-purple-800 disabled:opacity-50"
      >
        <Bookmark className="h-4 w-4" /> {activeName ? 'Save as new' : 'Save report'}
      </button>
    </div>
  )
}
