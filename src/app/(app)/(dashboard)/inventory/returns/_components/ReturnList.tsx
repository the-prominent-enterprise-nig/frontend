'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  X,
  PackageCheck,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { ReturnSummary } from '@/src/schema/inventory/returns'
import { useReturnsManager } from '../_hooks/useReturnsManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import CreateReturnModal from './CreateReturnModal'

const CONDITION_CONFIG = {
  sellable: {
    label: 'Sellable',
    className: 'bg-green-100 text-green-700',
    icon: PackageCheck,
  },
  damaged: {
    label: 'Damaged',
    className: 'bg-orange-100 text-orange-700',
    icon: AlertTriangle,
  },
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-700">{children}</dd>
    </div>
  )
}

/**
 * Everything the summary row hides — the money, the two accounting documents,
 * and the fields the table drops at narrow breakpoints. A return has no detail
 * page of its own (it is a single stock-ledger row, not a document), so this
 * is where the full record lives.
 */
function ReturnDetailRow({ ret }: { ret: ReturnSummary }) {
  const unitCost = ret.unitCost ?? null
  const value = unitCost != null ? unitCost * ret.quantity : null

  return (
    <tr className="bg-zinc-50/60">
      <td colSpan={10} className="px-4 pb-4 pt-1">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4">
          <DetailField label="Customer">
            {ret.customer ? (
              <>
                {ret.customer.name}
                {ret.customer.customerCode && (
                  <span className="ml-1 font-mono text-xs text-zinc-400">
                    {ret.customer.customerCode}
                  </span>
                )}
              </>
            ) : (
              <span className="text-zinc-400">Not recorded</span>
            )}
          </DetailField>

          <DetailField label="Warehouse">
            {ret.warehouse?.name ?? '—'}
            {ret.warehouse?.branch?.name && (
              <span className="ml-1 text-xs text-zinc-400">({ret.warehouse.branch.name})</span>
            )}
          </DetailField>

          <DetailField label="Serial number">
            {ret.serialNumber ? (
              <span className="font-mono text-xs">{ret.serialNumber}</span>
            ) : (
              <span className="text-zinc-400">Not serial-tracked</span>
            )}
          </DetailField>

          <DetailField label="Unit cost">
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
          </DetailField>

          <DetailField label="Value returned">
            {value != null ? fmtMoney(value) : <span className="text-zinc-400">—</span>}
          </DetailField>

          <DetailField label="Journal entry">
            {ret.journalEntryId ? (
              <Link
                href={`/accounting/journal-entries/${ret.journalEntryId}`}
                className="text-prominent-purple-700 hover:underline"
              >
                Dr Inventory / Cr COGS
              </Link>
            ) : (
              <span className="text-zinc-400">Not posted</span>
            )}
          </DetailField>

          <DetailField label="Credit memo">
            {ret.creditMemoNumber ? (
              <Link
                href="/accounting/credit-memos"
                className="font-mono text-prominent-purple-700 hover:underline"
              >
                {ret.creditMemoNumber}
              </Link>
            ) : (
              <span className="text-zinc-400">None issued</span>
            )}
          </DetailField>

          <DetailField label="Reference">
            {ret.originalSaleId ? (
              <span className="font-mono text-xs">{ret.originalSaleId}</span>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </DetailField>

          <DetailField label="Processed">{formatDate(ret.occurredAt ?? ret.createdAt)}</DetailField>

          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <dt className="text-xs uppercase tracking-wide text-zinc-400">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">
              {ret.notes || <span className="text-zinc-400">—</span>}
            </dd>
          </div>
        </dl>
      </td>
    </tr>
  )
}

export default function ReturnList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.RETURNS_CREATE)

  const {
    returns,
    pagination,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    fromDate,
    toDate,
    setWarehouseFilter,
    setFromDate,
    setToDate,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    serialOptions,
    createReturn,
    isCreating,
    refetch,
  } = useReturnsManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hasActiveFilters = !!(warehouseFilter || fromDate || toDate)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Returns</h1>
            {/* Says "in" explicitly because the Debit Memos tab next door
                moves stock the opposite way, and the two labels can't tell
                them apart on their own. */}
            <p className="mt-1 text-sm text-zinc-500">
              Customer stock coming <strong>back in</strong> to inventory. Sellable stock is
              immediately available; damaged stock goes to on-hand only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                Process Return
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Locations</option>
            {warehouseOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.branch?.name ?? w.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate ?? ''}
            onChange={(e) => setFromDate(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            title="From date"
          />
          <input
            type="date"
            value={toDate ?? ''}
            onChange={(e) => setToDate(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
            title="To date"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

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
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RotateCcw className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No returns found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Process a return to restock items and update inventory.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Condition
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Accounting
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Notes
                    </th>
                    <th className="w-10 px-2 py-3">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {returns.map((ret) => {
                    const cond = ret.condition ? CONDITION_CONFIG[ret.condition] : null
                    const isExpanded = expandedId === ret.id
                    return (
                      <Fragment key={ret.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                          className={`cursor-pointer hover:bg-zinc-50 ${isExpanded ? 'bg-zinc-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                            {formatDate(ret.occurredAt ?? ret.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-900">{ret.item?.name ?? '—'}</p>
                            <p className="font-mono text-xs text-zinc-400">{ret.item?.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                            {ret.warehouse?.branch?.name ?? ret.warehouse?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {ret.customer ? (
                              <>
                                <p className="text-zinc-700">{ret.customer.name}</p>
                                {ret.customer.customerCode && (
                                  <p className="font-mono text-xs text-zinc-400">
                                    {ret.customer.customerCode}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-zinc-400">Not recorded</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-zinc-900">
                            {ret.quantity}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {cond ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cond.className}`}
                              >
                                <cond.icon className="h-3 w-3" />
                                {cond.label}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">
                            {ret.originalSaleId ? (
                              <span className="font-mono">{ret.originalSaleId}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs hidden md:table-cell">
                            {ret.creditMemoNumber ? (
                              <Link
                                href="/accounting/credit-memos"
                                // The row itself toggles the detail panel, so the
                                // link must not do both on its way out.
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-prominent-purple-700 hover:underline"
                                title="Credit memo issued against the original invoice"
                              >
                                {ret.creditMemoNumber}
                              </Link>
                            ) : ret.journalEntryId ? (
                              <span className="text-zinc-500" title="Dr Inventory / Cr COGS posted">
                                Stock only
                              </span>
                            ) : (
                              <span className="text-zinc-400">Not posted</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell max-w-xs truncate">
                            {ret.notes ?? '—'}
                          </td>
                          <td className="px-2 py-3 text-zinc-400">
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </td>
                        </tr>
                        {isExpanded && <ReturnDetailRow ret={ret} />}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} returns
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-medium text-zinc-700">
                {page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                disabled={page >= pagination.totalPages}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateReturnModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createReturn}
        isSubmitting={isCreating}
        warehouseOptions={warehouseOptions}
        serialOptions={serialOptions}
      />
    </div>
  )
}
