'use client'

import { useState } from 'react'
import { Hash, RefreshCw, X, Truck } from 'lucide-react'
import { useSerialNumbers } from '../_hooks/useSerialNumbers'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SerialStatusSchema,
  type SerialStatus,
} from '@/src/schema/inventory/serial-numbers'
import RegisterSerialsModal from './RegisterSerialsModal'
import SearchableSelect from '@/src/components/ui/SearchableSelect'

const statusOptions = SerialStatusSchema.options

export default function SerialNumberList({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.SERIAL_MANAGE)
  const canManageCaravan = hasPermission(session, INVENTORY_PERMISSIONS.CARAVAN_MANAGE)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [moveTargetBranchId, setMoveTargetBranchId] = useState('')

  const {
    serials,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    itemFilter,
    warehouseFilter,
    search,
    setStatusFilter,
    setItemFilter,
    setWarehouseFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    itemOptions,
    branchOptions,
    registerSerials,
    isRegistering,
    refetch,
    caravanView,
    setCaravanView,
    caravanBranchId,
    setCaravanBranchId,
    caravanReady,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    closeConsignment,
    isClosingConsignment,
  } = useSerialNumbers(!!session.branchId)

  const hasFilters = statusFilter || itemFilter || warehouseFilter || search
  const showSelection = caravanView && canManageCaravan

  const handleReturnToOrigin = async () => {
    await closeConsignment(undefined)
  }

  const handleMoveOnward = async () => {
    if (!moveTargetBranchId) return
    await closeConsignment(moveTargetBranchId)
    setMoveTargetBranchId('')
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Serial Number Tracking</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Register, search, and track individual serial numbers across their lifecycle.
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
            {canManage && (
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Hash className="h-4 w-4" />
                Register Serials
              </button>
            )}
          </div>
        </div>

        {/* Scenario 08 (Caravan) Part 2 — tabs */}
        <div className="flex gap-1 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setCaravanView(false)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${
              !caravanView
                ? 'border-prominent-purple-700 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            All Serials
          </button>
          <button
            type="button"
            onClick={() => setCaravanView(true)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${
              caravanView
                ? 'border-prominent-purple-700 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Truck className="h-4 w-4" />
            Caravan @ Host
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value || undefined)}
            placeholder="Search serial numbers…"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 min-w-50"
          />
          <SearchableSelect
            className="min-w-40"
            value={statusFilter ?? ''}
            onChange={(v) => setStatusFilter((v || undefined) as SerialStatus | undefined)}
            placeholder="All Statuses"
            options={[
              { value: '', label: 'All Statuses' },
              ...statusOptions.map((s) => ({ value: s, label: SERIAL_STATUS_LABELS[s] })),
            ]}
          />
          <SearchableSelect
            className="min-w-55"
            value={itemFilter ?? ''}
            onChange={(v) => setItemFilter(v || undefined)}
            placeholder="All Items"
            options={[
              { value: '', label: 'All Items' },
              ...itemOptions.map((item) => ({
                value: item.id,
                label: `${item.sku} — ${item.name}`,
              })),
            ]}
          />
          {caravanView ? (
            !session.branchId && (
              <SearchableSelect
                className="min-w-50"
                value={caravanBranchId ?? ''}
                onChange={(v) => setCaravanBranchId(v || undefined)}
                placeholder="Select a branch…"
                options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
              />
            )
          ) : (
            <SearchableSelect
              className="min-w-50"
              value={warehouseFilter ?? ''}
              onChange={(v) => setWarehouseFilter(v || undefined)}
              placeholder="All Warehouses"
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouseOptions.map((wh) => ({
                  value: wh.id,
                  label: `${wh.code} — ${wh.name}`,
                })),
              ]}
            />
          )}
          {hasFilters && !caravanView && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {caravanView && !caravanReady && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              Select a branch above to see what's consigned to it.
            </p>
          </div>
        )}

        {/* Scenario 08 (Caravan) Part 5 — event close action bar */}
        {showSelection && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-prominent-purple-200 bg-prominent-purple-50 p-3">
            <span className="text-sm font-medium text-prominent-purple-800">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleReturnToOrigin}
              disabled={isClosingConsignment}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-prominent-purple-700 shadow-sm hover:bg-prominent-purple-100 disabled:opacity-50"
            >
              Return to Origin
            </button>
            <div className="flex items-center gap-2">
              <SearchableSelect
                className="min-w-40"
                value={moveTargetBranchId}
                onChange={setMoveTargetBranchId}
                placeholder="Move to…"
                options={branchOptions
                  .filter((b) => b.id !== caravanBranchId)
                  .map((b) => ({ value: b.id, label: b.name }))}
              />
              <button
                type="button"
                onClick={handleMoveOnward}
                disabled={!moveTargetBranchId || isClosingConsignment}
                className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                Move
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load serial numbers</p>
          </div>
        )}

        {/* Table */}
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
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : serials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              {caravanView ? (
                <>
                  <Truck className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">
                    Nothing currently consigned to this branch
                  </p>
                </>
              ) : (
                <>
                  <Hash className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">No serial numbers found</p>
                  {canManage && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Register serials to enable unit-level traceability.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    {showSelection && (
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={selectedIds.size > 0 && selectedIds.size === serials.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Serial #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Warehouse
                    </th>
                    {caravanView && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Home Branch
                      </th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {serials.map((serial) => (
                    <tr
                      key={serial.id}
                      className={`hover:bg-zinc-50 ${selectedIds.has(serial.id) ? 'bg-prominent-purple-50/60' : ''}`}
                    >
                      {showSelection && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${serial.serialNumber}`}
                            checked={selectedIds.has(serial.id)}
                            onChange={() => toggleSelected(serial.id)}
                            className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-700">
                        {serial.serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{serial.item?.name ?? '—'}</p>
                        {serial.item?.sku && (
                          <p className="font-mono text-xs text-zinc-400">{serial.item.sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                        {(serial.warehouse ?? serial.currentWarehouse)?.name ?? '—'}
                      </td>
                      {caravanView && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            {serial.currentWarehouse?.branch?.name ?? '—'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SERIAL_STATUS_COLORS[serial.status]}`}
                        >
                          {SERIAL_STATUS_LABELS[serial.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                        {serial.createdAt
                          ? new Date(serial.createdAt).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
      </div>

      <RegisterSerialsModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSubmit={registerSerials}
        isSubmitting={isRegistering}
        items={itemOptions.filter((i) => i.isSerialTracked)}
        warehouses={warehouseOptions}
      />
    </div>
  )
}
