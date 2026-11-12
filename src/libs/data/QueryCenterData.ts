import { api } from '@/src/libs/api/client'
import { downloadXlsx } from '@/src/libs/export/downloadXlsx'

// Scenario 62 — Data Query Center. Read-only raw data from every module,
// Business Owner only. The query travels JSON-encoded in `?q=` so an export
// lands in the audit log with its exact filters.

export type QueryColumnType = 'string' | 'number' | 'boolean' | 'date' | 'enum'

export interface QueryColumn {
  key: string
  label: string
  type: QueryColumnType
  queryable: boolean
  enumValues?: string[]
  isForeignKey?: boolean
  encrypted: boolean
}

export interface QueryDataset {
  key: string
  label: string
  module: string
  defaultSort: { column: string; dir: 'asc' | 'desc' } | null
  columns: QueryColumn[]
}

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'startsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty'

export interface QueryFilter {
  column: string
  op: FilterOp
  value?: string
}

export interface DatasetQuery {
  columns?: string[]
  filters?: QueryFilter[]
  sort?: { column: string; dir: 'asc' | 'desc' }
  limit?: number
  offset?: number
  /** Saved reports only — a grouped query runs through `summary`, and
   * `preview` never sends this. */
  groupBy?: SummaryGroup[]
}

export interface QueryResult {
  dataset: { key: string; label: string }
  columns: QueryColumn[]
  rows: Record<string, unknown>[]
  total: number
  offset: number
  limit: number
}

// ─── Report builder: group and total a dataset ───────────────────────────────

/** `same`: a text/date column on a grouped line — its value, or "(several)". */
export type SummaryFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'same'
export type DateBucket = 'day' | 'month' | 'year'

export interface SummaryGroup {
  column: string
  /** A date column groups by its day, month or year. */
  bucket?: DateBucket
}

export interface SummaryMeasure {
  fn: SummaryFn
  /** Omitted for a plain row count. */
  column?: string
}

export interface SummarySort {
  by: 'group' | 'measure'
  index: number
  dir: 'asc' | 'desc'
}

export interface SummaryQuery {
  filters?: QueryFilter[]
  groupBy?: SummaryGroup[]
  measures: SummaryMeasure[]
  sort?: SummarySort
}

export type GroupValue = string | number | boolean | null
export type MeasureValue = number | string | boolean | null

export interface SummaryResult {
  dataset: { key: string; label: string; module: string }
  groups: {
    key: string
    label: string
    type: QueryColumnType
    bucket: DateBucket | null
    /** A related-record group (Customer…): the id column it opens by. */
    idKey: string | null
  }[]
  measures: { fn: SummaryFn; column: string | null; label: string; type: QueryColumnType }[]
  /** `ids`: per group column, the related record's id (null otherwise). */
  rows: { keys: GroupValue[]; values: MeasureValue[]; ids?: GroupValue[] }[]
  totals: MeasureValue[]
  /** How many matching rows were totalled. */
  sourceRows: number
  groupCount: number
  /** More groups than the screen shows — the export has all of them. */
  truncated: boolean
}

// ─── Saved reports ───────────────────────────────────────────────────────────

export type SavedReportKind = 'rows' | 'summary' | 'multi'

/** One section of a Custom query: a dataset with its own filters. */
export interface QueryBlock {
  datasetKey: string
  kind: 'rows' | 'summary'
  definition: DatasetQuery | SummaryQuery
}

/** A Custom query: several datasets side by side. */
export interface MultiQuery {
  blocks: QueryBlock[]
}

/** The datasetKey a Custom query is saved under. */
export const MULTI_DATASET_KEY = 'multi'

export type ReportDefinition = DatasetQuery | SummaryQuery | MultiQuery

export interface SavedReport {
  id: string
  name: string
  datasetKey: string
  kind: SavedReportKind
  definition: ReportDefinition
  createdAt: string
  updatedAt: string
}

export const QueryCenter = {
  datasets: () => api.get<QueryDataset[]>('/query-center/datasets'),
  preview: (key: string, query: DatasetQuery) =>
    api.get<QueryResult>(`/query-center/datasets/${encodeURIComponent(key)}/preview`, {
      q: JSON.stringify(query),
    }),
  export: (key: string, query: DatasetQuery, format: 'xlsx' | 'csv') =>
    downloadXlsx(
      `/query-center/datasets/${encodeURIComponent(key)}/export`,
      { q: JSON.stringify({ ...query, limit: undefined, offset: undefined }), format },
      `query-${key}.${format}`
    ),
  summary: (key: string, query: SummaryQuery) =>
    api.get<SummaryResult>(`/query-center/datasets/${encodeURIComponent(key)}/summary`, {
      q: JSON.stringify(query),
    }),
  exportSummary: (key: string, query: SummaryQuery, format: 'xlsx' | 'csv') =>
    downloadXlsx(
      `/query-center/datasets/${encodeURIComponent(key)}/summary/export`,
      { q: JSON.stringify(query), format },
      `summary-${key}.${format}`
    ),
  exportMulti: (name: string, blocks: QueryBlock[]) =>
    downloadXlsx(
      '/query-center/multi/export',
      { q: JSON.stringify({ name, blocks }) },
      'custom-query.xlsx'
    ),
  reports: {
    list: () => api.get<SavedReport[]>('/query-center/reports'),
    save: (body: {
      name: string
      datasetKey: string
      kind: SavedReportKind
      definition: ReportDefinition
    }) => api.post<SavedReport>('/query-center/reports', body),
    update: (id: string, body: { name?: string; definition?: ReportDefinition }) =>
      api.patch<SavedReport>(`/query-center/reports/${encodeURIComponent(id)}`, body),
    remove: (id: string) => api.delete(`/query-center/reports/${encodeURIComponent(id)}`),
  },
}
