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
}

export interface QueryResult {
  dataset: { key: string; label: string }
  columns: QueryColumn[]
  rows: Record<string, unknown>[]
  total: number
  offset: number
  limit: number
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
}
