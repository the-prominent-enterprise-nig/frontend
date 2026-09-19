'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, RotateCcw, ChevronDown, FileWarning, Info, SearchX } from 'lucide-react'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { ReturnSummary } from '@/src/schema/inventory/returns'
import { useReturnsManager } from '../_hooks/useReturnsManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import Tooltip from '@/src/components/ui/Tooltip'
import CreateReturnScreen from './create-return/CreateReturnScreen'
import { locationLabel } from '@/src/libs/format/locationLabel'
import ReturnFilters from './list/ReturnFilters'
import ReturnLinesTable from './list/ReturnLinesTable'
import ReturnOutcomeBand from './list/ReturnOutcomeBand'
import ReturnPaperwork from './list/ReturnPaperwork'
import {
  abnormalStatus,
  CONDITION_CONFIG,
  OUTCOME_META,
  tallyDispositions,
  itemSummary,
  returnStatusNote,
  udsRefs,
  type ReturnStatusNote,
} from './list/returnDisplay'

function formatDay(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return `${formatDay(dateStr)}, ${formatTime(dateStr)}`
}

/** One condition, as a dot and a word. */
function ConditionChip({ value }: { value: string }) {
  const tone = CONDITION_CONFIG[value]
  if (!tone) return <span className="text-xs text-zinc-400">—</span>
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  )
}

/** The disposition chips a row shows when its lines disagree. */
function DispositionChips({ ret }: { ret: ReturnSummary }) {
  const tally = tallyDispositions(ret)
  if (!tally.length) return <span className="text-xs text-zinc-400">—</span>

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tally.map(({ disposition, count }) => {
        const tone = CONDITION_CONFIG[disposition]
        if (!tone) return null
        return (
          <span
            key={disposition}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${tone.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label}
            {count > 1 && <span className="font-mono opacity-70">×{count}</span>}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Where the unit went, and the one thing worth saying about it underneath.
 *
 * The references that used to stack up in this cell — RR, SI, POS, the credit
 * that never arrived — moved into the panel's Paperwork card, which has the
 * width to say what each one is.
 */
function OutcomeCell({ ret }: { ret: ReturnSummary }) {
  const outcome = ret.outcome ?? 'restocked'
  const meta = OUTCOME_META[outcome]
  const lineCount = ret.lineCount ?? ret.lines?.length ?? 0
  // A draft or voided document is not an outcome at all — nothing happened to
  // the unit — so it replaces the chip rather than sitting beside it.
  const abnormal = abnormalStatus(ret)

  if (abnormal) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
        {abnormal}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.chip}`}
      >
        {meta.rowLabel}
      </span>
      {outcome === 'document' && lineCount > 0 && (
        <span className="text-[11px] text-zinc-400">
          {lineCount} line{lineCount === 1 ? '' : 's'}
        </span>
      )}
      {outcome === 'restocked' && <span className="text-[11px] text-zinc-400">from POS</span>}
    </div>
  )
}

/**
 * The custody sheets a repaired return is sitting on.
 *
 * Repair is the one disposition where no stock moves — the unit stays the
 * customer's property and the UDS is the only record that we hold it. Reading
 * that off the list mattered enough that it was worth a column: finding it
 * otherwise meant expanding the row and reading down the lines table.
 */
function UdsCell({ ret }: { ret: ReturnSummary }) {
  const sheets = udsRefs(ret)
  if (!sheets.length) return <span className="text-xs text-zinc-400">—</span>

  return (
    <div className="flex flex-col items-start gap-0.5">
      <Link
        href="/inventory/uds"
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-[11px] text-prominent-purple-700 hover:underline"
        title="Custody is recorded on this UDS — no stock moved"
      >
        {sheets[0].code}
      </Link>
      {sheets.length > 1 && (
        <span className="text-[11px] text-zinc-400">
          +{sheets.length - 1} more sheet{sheets.length - 1 === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}

/** The one thing about this return somebody still has to know. */
function StatusCard({ note }: { note: ReturnStatusNote }) {
  const warn = note.tone === 'warn'
  const Icon = warn ? FileWarning : Info
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${warn ? 'text-amber-600' : 'text-zinc-400'}`} />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${warn ? 'text-amber-900' : 'text-zinc-900'}`}>
            {note.title}
          </p>
          <p className={`mt-0.5 text-sm ${warn ? 'text-amber-800' : 'text-zinc-600'}`}>
            {note.body}
          </p>
        </div>
      </div>
      {note.action && (
        <Link
          href={note.action.href}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4a189b]"
        >
          {note.action.label}
        </Link>
      )}
    </div>
  )
}

/** What a single-unit row was worth. A document carries this per line. */
function UnitValue({ ret }: { ret: ReturnSummary }) {
  const unitCost = ret.unitCost ?? null
  const value = unitCost != null ? unitCost * ret.quantity : null
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Unit cost
        </dt>
        <dd className="mt-0.5 text-sm text-zinc-700">
          {unitCost != null ? (
            fmtMoney(unitCost)
          ) : (
            <span
              className="text-zinc-400"
              title="No cost could be resolved when this was processed"
            >
              Not valued
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Value returned
        </dt>
        <dd className="mt-0.5 text-sm text-zinc-700">
          {value != null ? fmtMoney(value) : <span className="text-zinc-400">—</span>}
        </dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Serial number
        </dt>
        <dd className="mt-0.5 text-sm text-zinc-700">
          {ret.serialNumber ? (
            <span className="font-mono text-xs">{ret.serialNumber}</span>
          ) : (
            <span className="text-zinc-400">Not serial-tracked</span>
          )}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Everything the summary row hides — what is wrong with it if anything, the
 * lines, the money, and every document the return can be quoted back by.
 *
 * A document has no detail page of its own, and does not need one: the list
 * row expands into the whole record.
 */
function ReturnDetailRow({ ret }: { ret: ReturnSummary }) {
  const lines = ret.lines ?? []
  const note = returnStatusNote(ret)

  return (
    <tr className="bg-zinc-50/60">
      <td colSpan={8} className="px-4 pb-4 pt-1">
        <div className="space-y-3">
          {note && <StatusCard note={note} />}
          {lines.length > 0 ? <ReturnLinesTable lines={lines} /> : <UnitValue ret={ret} />}
          <ReturnPaperwork ret={ret} processedAt={formatDate(ret.occurredAt ?? ret.createdAt)} />
        </div>
      </td>
    </tr>
  )
}

const TH = 'px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500'

export default function ReturnList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.RETURNS_CREATE)

  const {
    returns,
    pagination,
    isLoading,
    isFetching,
    error,
    outcomeCounts,
    warehouseFilter,
    fromDate,
    toDate,
    dateRange,
    search,
    outcome,
    setWarehouseFilter,
    setFromDate,
    setToDate,
    setDateRange,
    setSearch,
    setOutcome,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    createReturn,
    isCreating,
    refetch,
  } = useReturnsManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hasActiveFilters = !!(warehouseFilter || fromDate || toDate || search || outcome)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        {/* Header chrome — sizes, weights and the #5b21b6 primary — is shared
            with Stock Transfers next door, so the two inventory movement
            screens read as one surface rather than two designs. */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#17171c]">
              Stock returns
            </h1>
            {/* Says "in" explicitly because the Debit Memos tab next door
                moves stock the opposite way, and the two labels can't tell
                them apart on their own. */}
            <p className="text-[13px] text-[#5b5b6b]">
              Customer stock coming <strong>back in</strong> to inventory. Sellable stock is
              immediately available; damaged stock goes to on-hand only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[9px]">
            <Tooltip label="Reload the list">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh"
                className="flex items-center gap-[7px] rounded-lg border border-[#d3d3db] bg-white px-[14px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#faf9fb] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </Tooltip>
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-[7px] rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
              >
                <Plus className="h-3.5 w-3.5" />
                Process return
              </button>
            )}
          </div>
        </div>

        <ReturnOutcomeBand counts={outcomeCounts} selected={outcome} onSelect={setOutcome} />

        <ReturnFilters
          search={search}
          onSearch={setSearch}
          warehouseFilter={warehouseFilter}
          onWarehouse={setWarehouseFilter}
          dateRange={dateRange}
          onDateRange={setDateRange}
          fromDate={fromDate}
          toDate={toDate}
          onFromDate={setFromDate}
          onToDate={setToDate}
          warehouseOptions={warehouseOptions}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load returns</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : returns.length === 0 && hasActiveFilters ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <SearchX className="mb-3 h-9 w-9 text-zinc-300" />
              <p className="text-base font-semibold text-zinc-800">No returns match</p>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                {search
                  ? `Nothing matches “${search}”. Try a serial, an RR number or the customer's name.`
                  : 'No returns fall inside these filters.'}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Clear search and filters
              </button>
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <RotateCcw className="mb-3 h-9 w-9 text-zinc-300" />
              <p className="text-base font-semibold text-zinc-800">No returns yet</p>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                When a customer brings something back, process it here so the unit and its serial
                land in the right stock state.
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 flex items-center gap-[7px] rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Process return
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="w-9 px-2 py-2.5">
                      <span className="sr-only">Details</span>
                    </th>
                    <th className={TH}>Returned</th>
                    <th className={TH}>Item</th>
                    <th className={`${TH} hidden md:table-cell`}>Customer</th>
                    <th className={`${TH} text-right`}>Qty</th>
                    <th className={TH}>Condition</th>
                    <th className={`${TH} hidden md:table-cell`}>Outcome</th>
                    <th className={`${TH} hidden lg:table-cell`}>UDS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {returns.map((ret) => {
                    const isExpanded = expandedId === ret.id
                    const item = itemSummary(ret)
                    const toggle = () => setExpandedId(isExpanded ? null : ret.id)
                    return (
                      <Fragment key={ret.id}>
                        <tr
                          onClick={toggle}
                          // Rows carry the only way into a return's detail, so
                          // they have to be reachable without a mouse. A bare
                          // <tr> is not focusable and answers no key.
                          tabIndex={0}
                          role="button"
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggle()
                            }
                          }}
                          className={`hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-prominent-purple-500 ${isExpanded ? 'bg-zinc-50' : ''}`}
                        >
                          <td className="px-2 py-3 align-top text-zinc-400">
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </td>

                          {/* When it came back, under what number, and where
                              it landed. The location used to be a column of
                              its own; it is read far less often than it was
                              wide. The RTN- number stays on the row and not
                              in the panel with the rest of the paperwork,
                              because it is the one a customer quotes back and
                              the only thing that names the row. */}
                          <td className="px-3 py-3 align-top whitespace-nowrap">
                            <p className="text-xs text-zinc-700">
                              {formatDay(ret.occurredAt ?? ret.createdAt)}
                            </p>
                            {ret.returnNumber && (
                              <p className="mt-0.5 font-mono text-[11px] text-zinc-600">
                                {ret.returnNumber}
                              </p>
                            )}
                            <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                              {formatTime(ret.occurredAt ?? ret.createdAt)} ·{' '}
                              {locationLabel(ret.warehouse)}
                            </p>
                          </td>

                          {/* A document with several lines has no one item to
                              name — the API sends `item: null` on purpose —
                              so the cell counts them and names the first
                              couple instead of showing a dash. */}
                          <td className="px-3 py-3 align-top">
                            <p className="line-clamp-2 font-medium text-zinc-900">{item.title}</p>
                            {item.detail && (
                              <p
                                className={`mt-0.5 text-xs text-zinc-400 ${item.mono ? 'font-mono' : ''}`}
                              >
                                {item.detail}
                              </p>
                            )}
                            {/* Below `md` the last two columns are gone, so
                                what they said folds in here rather than
                                dropping off the screen entirely. */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
                              <OutcomeCell ret={ret} />
                              <span className="text-[11px] text-zinc-500">
                                {ret.customer?.name ?? 'Walk-in'}
                              </span>
                            </div>
                          </td>

                          <td className="hidden px-3 py-3 align-top md:table-cell">
                            {ret.customer ? (
                              <>
                                <p className="text-zinc-700">{ret.customer.name}</p>
                                {ret.customer.customerCode && (
                                  <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                                    {ret.customer.customerCode}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-zinc-400">Walk-in</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-right align-top font-mono font-semibold tabular-nums text-zinc-900">
                            {ret.quantity}
                          </td>

                          {/* One chip when the row has one answer, all of them
                              when it does not. A document reports no single
                              condition by design. */}
                          <td className="px-3 py-3 align-top">
                            {ret.condition ? (
                              <ConditionChip value={ret.condition} />
                            ) : (
                              <DispositionChips ret={ret} />
                            )}
                          </td>

                          <td className="hidden px-3 py-3 align-top md:table-cell">
                            <OutcomeCell ret={ret} />
                          </td>

                          <td className="hidden px-3 py-3 align-top lg:table-cell">
                            <UdsCell ret={ret} />
                          </td>
                        </tr>
                        {isExpanded && <ReturnDetailRow ret={ret} />}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              {/* The count stays put on a single page — it is how many
                  returns matched, which is worth reading even when they all
                  fit. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 py-2.5 text-sm text-zinc-500">
                <span>
                  Showing {(page - 1) * pagination.limit + 1}–
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}{' '}
                  returns
                </span>
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-zinc-700">
                      {page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page >= pagination.totalPages}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isCreateOpen && (
        <CreateReturnScreen
          onClose={() => setIsCreateOpen(false)}
          onSubmit={createReturn}
          isSubmitting={isCreating}
          warehouseOptions={warehouseOptions}
        />
      )}
    </div>
  )
}
