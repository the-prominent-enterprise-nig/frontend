'use client'

import { Fragment, useState, useMemo, useCallback, useTransition } from 'react'
import { ClipboardList, ChevronLeft, ChevronRight, ChevronDown, Search, X } from 'lucide-react'
import { getAuditLogs } from '@/src/app/(app)/(dashboard)/settings/_actions/get-audit-logs'
import type {
  AuditLogListResponse,
  AuditLogQueryParams,
  UserAuditLog,
  ScopeType,
} from '@/src/schema/settings/audit-logs'
import type { BranchDetail } from '@/src/app/(app)/(dashboard)/settings/_actions/get-branches'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  APPROVE: 'bg-amber-100 text-amber-700',
}

const SCOPE_LABELS: Record<ScopeType, string> = {
  ALL: 'All',
  BRANCH: 'Branch',
  DEPARTMENT: 'Dept',
}

const SCOPE_COLORS: Record<ScopeType, string> = {
  ALL: 'bg-zinc-100 text-zinc-600',
  BRANCH: 'bg-blue-100 text-blue-700',
  DEPARTMENT: 'bg-purple-100 text-purple-700',
}

// resourceType is a declarative "<module>:<resource-kebab-case>" string (e.g.
// "inventory:stock-adjustment") that grows every time a new module gets
// instrumented — a hardcoded label map would silently go stale, so this
// derives a readable label from the string itself instead. The module
// prefix set is small and stable (unlike resource types), so it's the one
// spot worth a manual override — mainly for acronyms Title Case mangles.
const MODULE_LABEL_OVERRIDES: Record<string, string> = {
  crm: 'CRM',
  pos: 'POS',
  hr: 'HR',
}

function formatResourceType(resourceType: string): { module: string; resource: string } {
  const toTitleCase = (segment: string) =>
    segment
      .split('-')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const [modulePart, ...rest] = resourceType.split(':')
  const moduleLabel = MODULE_LABEL_OVERRIDES[modulePart] ?? toTitleCase(modulePart)
  if (rest.length === 0) {
    return { module: '', resource: moduleLabel }
  }
  return { module: moduleLabel, resource: toTitleCase(rest.join(':')) }
}

// A transaction's line-level item(s) (e.g. what a stock transfer/adjustment/
// batch actually concerns) never change across a status transition, so
// putting them in oldValues/newValues would make them invisible to the
// changed-fields-only diff filter — writers instead put them in
// metadata.items, which this always renders regardless of whether anything
// else on the row changed.
function getMetadataItems(log: UserAuditLog): string[] {
  const items = log.metadata?.items
  if (!Array.isArray(items)) return []
  return items.filter((item): item is string => typeof item === 'string')
}

function ScopeBadge({
  log,
  branchNameById,
}: {
  log: UserAuditLog
  branchNameById: Map<string, string>
}) {
  // Rows merged in from AccountingAuditLog (SCEN-29) carry no scope at all —
  // that table has no scopeType column.
  if (!log.scopeType) {
    return <span className="text-xs text-zinc-400">—</span>
  }

  const label = SCOPE_LABELS[log.scopeType] ?? log.scopeType
  const color = SCOPE_COLORS[log.scopeType] ?? 'bg-zinc-100 text-zinc-600'
  // Falls back to a truncated ID when the branch can't be resolved (e.g. a
  // since-deleted branch, or the /branches lookup failing) — never blocks
  // the row itself from rendering.
  const branchName = log.scopeBranchId && branchNameById.get(log.scopeBranchId)
  const detail =
    log.scopeType === 'BRANCH' && log.scopeBranchId
      ? ` · ${branchName ?? log.scopeBranchId.slice(0, 8)}`
      : log.scopeType === 'DEPARTMENT' && log.scopeDepartmentId
        ? ` · ${log.scopeDepartmentId.slice(0, 8)}`
        : ''

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
      title={
        log.scopeType === 'BRANCH'
          ? `Branch: ${branchName ?? log.scopeBranchId ?? '—'}`
          : log.scopeType === 'DEPARTMENT'
            ? `Department ID: ${log.scopeDepartmentId ?? '—'}`
            : 'All branches and departments'
      }
    >
      {label}
      {detail}
    </span>
  )
}

// A nested object (e.g. tax-rate approval's appliedTaxRate) reads as
// "name: X, rate: 5, ..." rather than a raw JSON blob — recurses so a
// deeper nested value still gets the same treatment instead of falling
// back to JSON.stringify.
function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    return value.length === 0 ? '(none)' : value.map(formatSnapshotValue).join(', ')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.length === 0
      ? '(none)'
      : entries.map(([key, entryValue]) => `${key}: ${formatSnapshotValue(entryValue)}`).join(', ')
  }
  return String(value)
}

// Only fields that actually changed are worth a business owner's attention —
// an unchanged reference field (e.g. bankAccountId on a reconciliation)
// sitting next to itself twice is noise, not a diff.
function getChangedKeys(
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null
): string[] {
  return Array.from(
    new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])
  ).filter((key) => JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key]))
}

// A bare foreign-key field (cashierId, terminalId, branchId, ...) reads as
// noise in a one-line preview — its raw UUID says nothing about what
// happened, and is often already shown elsewhere on the same row (e.g. a
// session's cashierId duplicating the Actor column when someone opens their
// own session). Still shown when it's genuinely the only field available
// (never fully hidden), just deprioritized and truncated.
function isIdLikeKey(key: string): boolean {
  return /Id$/.test(key)
}

// Long ID-shaped values (UUIDs) dominate a compact preview line — shortened
// here only, never in the full expanded SnapshotDiff view where precision
// matters more than scannability.
function formatPreviewValue(key: string, value: unknown): string {
  const formatted = formatSnapshotValue(value)
  return isIdLikeKey(key) && formatted.length > 12 ? `${formatted.slice(0, 8)}…` : formatted
}

// A one-line "what actually happened" summary shown directly in the row, so
// scanning the log doesn't require expanding every entry. Prioritizes the
// `status` transition (the primary marker for almost every action in this
// system), a `*Reason` field (the most human-relevant part of a
// reject/decline), or any other non-ID field, falling back to whatever
// changed first only if every changed field is ID-shaped. CREATE/DELETE-like
// rows have only one side to draw from, so they preview a couple of the new
// (or removed) record's own fields instead of a transition.
function buildActionPreview(log: UserAuditLog): string | null {
  const { oldValues, newValues } = log
  if (oldValues && newValues) {
    const changed = getChangedKeys(oldValues, newValues)
    if (changed.length === 0) return null
    const primary =
      changed.find((key) => key === 'status') ??
      changed.find((key) => /reason$/i.test(key)) ??
      changed.find((key) => !isIdLikeKey(key)) ??
      changed[0]
    const line = `${primary}: ${formatPreviewValue(primary, oldValues[primary])} → ${formatPreviewValue(primary, newValues[primary])}`
    const remaining = changed.length - 1
    return remaining > 0 ? `${line} (+${remaining} more)` : line
  }

  // No real before/after to diff (CREATE/ADD_LINE/DELETE-shaped) — prefer
  // the readable item/context summary a writer put in metadata.items over
  // dumping raw newValues keys, since those are often bare foreign-key IDs
  // (itemId, lineId, ...) rather than anything a business owner can read.
  const metadataItems = getMetadataItems(log)
  if (metadataItems.length > 0) return metadataItems.join(', ')

  const soleSide = newValues ?? oldValues
  if (!soleSide) return null
  const populatedKeys = Object.keys(soleSide).filter(
    (key) => soleSide[key] !== null && soleSide[key] !== undefined
  )
  // Non-ID fields first (e.g. status, amount, name) — only reach for an
  // ID-shaped field if literally nothing else was populated, so a preview
  // is never silently empty just because every field happened to be an FK.
  const nonIdKeys = populatedKeys.filter((key) => !isIdLikeKey(key))
  const keys = (nonIdKeys.length > 0 ? nonIdKeys : populatedKeys).slice(0, 2)
  if (keys.length === 0) return null
  return keys.map((key) => `${key}: ${formatPreviewValue(key, soleSide[key])}`).join(', ')
}

// Compact before/after grid for rows carrying an AccountingAuditLog
// snapshot — the union of both objects' keys, one row each, changed values
// highlighted so a diff is scannable at a glance rather than two raw JSON
// blobs side by side.
function SnapshotDiff({
  oldValues,
  newValues,
}: {
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}) {
  const keys = getChangedKeys(oldValues, newValues).sort()

  if (keys.length === 0) {
    return <p className="text-xs text-zinc-400">No fields changed.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full text-xs">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Field</th>
            <th className="px-3 py-2 text-left font-medium">Before</th>
            <th className="px-3 py-2 text-left font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-t border-zinc-100">
              <td className="px-3 py-1.5 font-medium text-zinc-700">{key}</td>
              <td className="px-3 py-1.5 text-red-600 line-through decoration-red-300">
                {formatSnapshotValue(oldValues?.[key])}
              </td>
              <td className="px-3 py-1.5 font-medium text-green-700">
                {formatSnapshotValue(newValues?.[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({
  page,
  lastPage,
  onPage,
  isPending,
}: {
  page: number
  lastPage: number
  onPage: (p: number) => void
  isPending: boolean
}) {
  if (lastPage <= 1) return null

  const pages = Array.from({ length: Math.min(lastPage, 5) }, (_, i) => {
    if (lastPage <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= lastPage - 2) return lastPage - 4 + i
    return page - 2 + i
  })

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={page <= 1 || isPending}
        onClick={() => onPage(page - 1)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          disabled={isPending}
          onClick={() => onPage(p)}
          className={`min-w-[2rem] rounded-lg px-2 py-1 text-sm transition ${
            p === page
              ? 'bg-prominent-purple-700 font-medium text-white'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= lastPage || isPending}
        onClick={() => onPage(page + 1)}
        className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function AuditLogsSection({
  initialData,
  branches = [],
  resourceTypes = [],
}: {
  initialData: AuditLogListResponse
  branches?: BranchDetail[]
  resourceTypes?: string[]
}) {
  const [data, setData] = useState<AuditLogListResponse>(initialData)
  const [filters, setFilters] = useState<AuditLogQueryParams>({ page: 1, limit: 10 })
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches])
  // SearchableSelect filters by label text, so typing "pos" or "transaction"
  // already works without any extra fuzzy-matching logic — the label is
  // "<Module> · <Resource>" (e.g. "POS · Transaction"), built from the same
  // formatResourceType() used everywhere else on this page.
  const resourceTypeOptions = useMemo(
    () =>
      resourceTypes.map((value) => {
        const { module, resource } = formatResourceType(value)
        return { value, label: module ? `${module} · ${resource}` : resource }
      }),
    [resourceTypes]
  )

  const fetchLogs = useCallback((newFilters: AuditLogQueryParams) => {
    startTransition(async () => {
      const result = await getAuditLogs(newFilters)
      if (result.success && result.data) setData(result.data)
    })
  }, [])

  const applyFilters = (partial: Partial<AuditLogQueryParams>) => {
    const next = { ...filters, ...partial, page: 1 }
    setFilters(next)
    fetchLogs(next)
  }

  const handlePage = (page: number) => {
    const next = { ...filters, page }
    setFilters(next)
    fetchLogs(next)
  }

  const clearFilters = () => {
    const next: AuditLogQueryParams = { page: 1, limit: 10 }
    setFilters(next)
    fetchLogs(next)
  }

  const hasActiveFilters =
    !!filters.actorId || !!filters.resourceType || !!filters.dateFrom || !!filters.dateTo

  const { data: logs, meta } = data

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Actor</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by actor name or ID..."
                value={filters.actorId ?? ''}
                onChange={(e) => applyFilters({ actorId: e.target.value || undefined })}
                className="w-full rounded-lg border border-zinc-200 py-2 pl-8 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
            </div>
          </div>
          <div className="w-full lg:w-56">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Resource Type</label>
            <SearchableSelect
              value={filters.resourceType ?? ''}
              onChange={(value) => applyFilters({ resourceType: value || undefined })}
              options={resourceTypeOptions}
              placeholder="Search e.g. POS, transaction…"
              clearable
            />
          </div>
          <div className="w-full lg:w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500">From</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => applyFilters({ dateFrom: e.target.value || undefined })}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </div>
          <div className="w-full lg:w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500">To</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => applyFilters({ dateTo: e.target.value || undefined })}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className={`rounded-2xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isPending ? 'opacity-60' : ''}`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Actor</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Resource</th>
                <th className="px-4 py-3 text-left font-medium">Scope at Time</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => {
                  // A genuine diff needs both sides — CREATE-like events
                  // (CREATE, SUBMIT_*, REVERSE, CLEAR, ...) have no "before"
                  // at all, so expanding would just dump newValues instead
                  // of showing an actual before/after comparison. DELETE
                  // still qualifies: it has a real before (the full prior
                  // state) worth showing even though "after" is just a marker.
                  const hasSnapshot = Boolean(log.oldValues) && Boolean(log.newValues)
                  const isExpanded = expandedId === log.id
                  const { module, resource } = formatResourceType(log.resourceType)
                  const preview = buildActionPreview(log)
                  const metadataItems = getMetadataItems(log)
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={
                          hasSnapshot ? () => setExpandedId(isExpanded ? null : log.id) : undefined
                        }
                        className={`border-t border-zinc-100 hover:bg-zinc-50 ${hasSnapshot ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900">{log.actorName}</div>
                          <div className="break-all text-xs text-zinc-400">{log.actorId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-zinc-100 text-zinc-600'}`}
                          >
                            {log.action}
                          </span>
                          {preview && (
                            <div
                              className="mt-1 max-w-[16rem] truncate text-xs text-zinc-500"
                              title={preview}
                            >
                              {preview}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div>
                              {module && (
                                <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                  {module}
                                </div>
                              )}
                              <div className="font-medium text-zinc-700">{resource}</div>
                            </div>
                            {hasSnapshot && (
                              <ChevronDown
                                className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            )}
                          </div>
                          {log.resourceName && (
                            <div className="text-xs text-zinc-500">{log.resourceName}</div>
                          )}
                          {log.resourceId && !log.resourceName && (
                            <div className="break-all text-xs text-zinc-400">{log.resourceId}</div>
                          )}
                          {metadataItems.length > 0 && (
                            <div className="mt-1 text-xs text-zinc-500">
                              {metadataItems.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ScopeBadge log={log} branchNameById={branchNameById} />
                        </td>
                        <td className="px-4 py-3 text-zinc-500" suppressHydrationWarning>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-zinc-100 bg-zinc-50/60">
                          <td colSpan={5} className="px-4 py-3">
                            <SnapshotDiff oldValues={log.oldValues} newValues={log.newValues} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 text-zinc-300" />
                      <p className="text-zinc-500">No audit entries found.</p>
                      {hasActiveFilters && (
                        <p className="text-xs text-zinc-400">Try adjusting your filters.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: count + pagination */}
      {meta.total > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
          </p>
          <Pagination
            page={meta.page}
            lastPage={meta.lastPage}
            onPage={handlePage}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  )
}
