'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Search, X, Pencil, Warehouse, MapPin } from 'lucide-react'
import { useWarehouseManager } from '../_hooks/useWarehouseManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { WarehouseSummary, UpdateWarehouseFormValues } from '@/src/schema/inventory/warehouses'
import CreateWarehouseModal from './CreateWarehouseModal'
import EditWarehouseModal from './EditWarehouseModal'
import LocationsPanel from './LocationsPanel'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-zinc-100 text-zinc-500',
}

export default function WarehouseList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSES_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSES_UPDATE)

  const {
    warehouses,
    pagination,
    isLoading,
    isFetching,
    error,
    search,
    statusFilter,
    setSearch,
    setStatusFilter,
    resetFilters,
    page,
    setPage,
    selectedWarehouse,
    setSelectedWarehouse,
    locations,
    isLoadingLocations,
    createWarehouse,
    isCreating,
    updateWarehouse,
    isUpdating,
    addLocation,
    isAddingLocation,
    refetch,
  } = useWarehouseManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WarehouseSummary | null>(null)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Warehouses</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage physical storage locations and sub-locations for accurate stock tracking.
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
                Add Warehouse
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter((e.target.value || undefined) as typeof statusFilter)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || statusFilter) && (
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
            <p className="text-sm font-medium text-red-800">Failed to load warehouses</p>
            <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
          </div>
        )}

        {/* Main content — table + optional locations panel */}
        <div
          className={`grid gap-4 ${selectedWarehouse ? 'lg:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}
        >
          {/* Warehouse Table */}
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
                    <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                    <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                  </div>
                ))}
              </div>
            ) : warehouses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Warehouse className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No warehouses found</p>
                {canCreate && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Create your first warehouse to get started.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                        Address
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Locations
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {warehouses.map((wh) => {
                      const isSelected = selectedWarehouse?.id === wh.id
                      const locationCount = wh._count?.locations ?? 0
                      return (
                        <tr
                          key={wh.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-prominent-purple-50' : 'hover:bg-zinc-50'}`}
                          onClick={() => setSelectedWarehouse(isSelected ? null : wh)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">
                            {wh.code}
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-900">{wh.name}</td>
                          <td className="px-4 py-3 text-zinc-500 hidden md:table-cell max-w-[200px] truncate">
                            {wh.address ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[wh.status ?? 'active'] ?? STATUS_COLORS.active}`}
                            >
                              {wh.status ?? 'active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedWarehouse(isSelected ? null : wh)
                              }}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${isSelected ? 'bg-prominent-purple-100 text-prominent-purple-700' : 'bg-zinc-100 text-zinc-600 hover:bg-prominent-purple-50 hover:text-prominent-purple-600'}`}
                            >
                              <MapPin className="h-3 w-3" />
                              {locationCount}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditTarget(wh)
                                  }}
                                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                                >
                                  <Pencil className="h-4 w-4" />
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

          {/* Locations panel */}
          {selectedWarehouse && (
            <div className="h-fit lg:sticky lg:top-6">
              <LocationsPanel
                warehouse={selectedWarehouse}
                locations={locations}
                isLoading={isLoadingLocations}
                canUpdate={canUpdate}
                onClose={() => setSelectedWarehouse(null)}
                onAddLocation={addLocation}
                isAddingLocation={isAddingLocation}
              />
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} warehouses
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

      <CreateWarehouseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createWarehouse}
        isSubmitting={isCreating}
      />

      <EditWarehouseModal
        isOpen={!!editTarget}
        warehouse={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(data: UpdateWarehouseFormValues) => updateWarehouse(editTarget!.id, data)}
        isSubmitting={isUpdating}
      />
    </div>
  )
}
