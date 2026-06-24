'use client'

import { useState } from 'react'
import { PackageCheck, RefreshCw, X, TrendingDown, AlertTriangle, ExternalLink } from 'lucide-react'
import { useGoodsReceiving } from '../_hooks/useGoodsReceiving'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import ReceiveStockModal from './ReceiveStockModal'
import { useUIShell } from '@/src/stores/ui-shell.store'

export default function GoodsReceivingList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const { pushPanel } = useUIShell()

  const {
    balances,
    pagination,
    isLoading,
    isFetching,
    error,
    warehouseFilter,
    search,
    setWarehouseFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    purchaseOrderOptions,
    receiveStock,
    isReceiving,
    ledgerEntries,
    ledgerItemId,
    setLedgerItemId,
    isLoadingLedger,
    refetch,
  } = useGoodsReceiving()

  const hasFilters = warehouseFilter || search

  function getStockLevel(balance: StockBalance) {
    const onHand = balance.onHandQty ?? 0
    const reorder = balance.reorderPoint ?? null
    if (reorder === null) return 'normal'
    if (onHand <= 0) return 'out'
    if (onHand <= reorder) return 'low'
    return 'normal'
  }

  const stockLevelColors = {
    out: 'bg-red-100 text-red-700',
    low: 'bg-amber-100 text-amber-700',
    normal: 'bg-green-100 text-green-700',
  }
  const stockLevelLabels = { out: 'Out of Stock', low: 'Low Stock', normal: 'In Stock' }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Goods Receiving</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Receive incoming stock and update inventory balances. Track by PO reference.
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
                onClick={() => setIsReceiveOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <PackageCheck className="h-4 w-4" />
                Receive Stock
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value || undefined)}
            placeholder="Search items…"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 min-w-[200px]"
          />
          <select
            value={warehouseFilter ?? ''}
            onChange={(e) => setWarehouseFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Warehouses</option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load stock balances</p>
          </div>
        )}

        {/* Stock balances table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <PackageCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No stock balances found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Receive your first shipment to populate balances.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      On Hand
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Available
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Reorder Pt.
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {balances.map((balance) => {
                    const level = getStockLevel(balance)
                    return (
                      <tr key={balance.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{balance.item?.name ?? '—'}</p>
                          {balance.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{balance.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {balance.warehouse?.code ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-zinc-800">
                          {balance.onHandQty ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600 hidden md:table-cell">
                          {balance.availableQty ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-500 hidden lg:table-cell">
                          {balance.reorderPoint !== null && balance.reorderPoint !== undefined
                            ? balance.reorderPoint
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${stockLevelColors[level]}`}
                          >
                            {level === 'low' && <TrendingDown className="h-3 w-3" />}
                            {level === 'out' && <AlertTriangle className="h-3 w-3" />}
                            {stockLevelLabels[level]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setLedgerItemId(
                                  ledgerItemId === balance.item?.id ? undefined : balance.item?.id
                                )
                              }
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              History
                            </button>
                            {balance.item?.id && (
                              <button
                                type="button"
                                onClick={() =>
                                  pushPanel({
                                    type: 'item360',
                                    itemId: balance.item!.id,
                                    itemName: balance.item?.name,
                                  })
                                }
                                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                                title="View item details"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
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

        {/* Ledger drawer */}
        {ledgerItemId && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h3 className="font-semibold text-zinc-900">Stock Movement History</h3>
              <button
                type="button"
                onClick={() => setLedgerItemId(undefined)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isLoadingLedger ? (
              <div className="p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="mb-3 h-4 animate-pulse rounded bg-zinc-200" />
                ))}
              </div>
            ) : ledgerEntries.length === 0 ? (
              <p className="p-6 text-sm text-zinc-400 text-center">No movement history</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Qty
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                        Reference
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                        Date
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                        By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {entry.movementType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-zinc-800">
                          {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500 hidden sm:table-cell">
                          {entry.referenceType
                            ? `${entry.referenceType} ${entry.referenceId ?? ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500 hidden md:table-cell">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500 hidden lg:table-cell">
                          {entry.createdBy?.name ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <ReceiveStockModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        onSubmit={receiveStock}
        isSubmitting={isReceiving}
        warehouses={warehouseOptions}
        purchaseOrders={purchaseOrderOptions}
      />
    </div>
  )
}
