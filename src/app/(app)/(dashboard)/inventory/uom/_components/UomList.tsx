'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Search, X, Pencil, Ruler } from 'lucide-react'
import { useUomManager } from '../_hooks/useUomManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import UomFormModal from './UomFormModal'
import type { CreateUomFormValues } from '@/src/schema/inventory/uom'

export default function UomList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.UOM_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.UOM_UPDATE)

  const {
    uoms,
    pagination,
    isLoading,
    isFetching,
    error,
    search,
    setSearch,
    page,
    setPage,
    baseUnits,
    editTarget,
    setEditTarget,
    createUom,
    isCreating,
    updateUom,
    isUpdating,
    refetch,
  } = useUomManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  async function handleSubmit(data: CreateUomFormValues) {
    if (editTarget) {
      return updateUom(editTarget.id, data)
    }
    return createUom(data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Units of Measure</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Define units and conversion factors for purchasing and selling.
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
                onClick={() => {
                  setEditTarget(null)
                  setIsCreateOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Unit
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by code or name…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load units of measure</p>
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
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : uoms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Ruler className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No units of measure found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a base unit first, then add alternate units with conversion factors.
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
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Base Unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Conversion Factor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Example
                    </th>
                    {canUpdate && (
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {uoms.map((uom) => {
                    const isBase = uom.isBaseUnit === true
                    const factor = uom.conversionFactor
                    const baseCode = uom.baseUnit?.code

                    return (
                      <tr key={uom.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-800">
                          {uom.code}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{uom.name}</td>
                        <td className="px-4 py-3 text-center">
                          {isBase ? (
                            <span className="inline-flex items-center rounded-full bg-prominent-purple-100 px-2.5 py-0.5 text-xs font-medium text-prominent-purple-700">
                              Base
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                              Alternate
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                          {isBase ? '—' : (baseCode ?? uom.baseUnitId ?? '—')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isBase ? (
                            <span className="text-zinc-400">1</span>
                          ) : factor != null ? (
                            <span className="font-medium text-zinc-800">{factor}×</span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-zinc-500">
                          {!isBase && factor != null && baseCode ? (
                            <span>
                              1 {uom.code} = {factor} {baseCode}
                            </span>
                          ) : isBase ? (
                            <span className="text-zinc-300">reference</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        {canUpdate && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditTarget(uom)
                                setIsCreateOpen(true)
                              }}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Conversion reference card */}
        {uoms.some((u) => !u.isBaseUnit) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">Conversion Reference</h3>
            <p className="mb-3 text-xs text-zinc-500">
              When receiving in an alternate unit, multiply quantity by the conversion factor to get
              base-unit stock. When selling in an alternate unit, divide base-unit stock by the
              factor to get available selling units.
            </p>
            <div className="flex flex-wrap gap-3">
              {uoms
                .filter((u) => !u.isBaseUnit && u.conversionFactor != null && u.baseUnit)
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                  >
                    <span className="font-mono font-semibold text-zinc-800">{u.code}</span>
                    <span className="text-zinc-400">=</span>
                    <span className="font-medium text-prominent-purple-700">
                      {u.conversionFactor}×
                    </span>
                    <span className="font-mono text-zinc-500">{u.baseUnit!.code}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} units
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

      <UomFormModal
        isOpen={isCreateOpen}
        editTarget={editTarget}
        onClose={() => {
          setIsCreateOpen(false)
          setEditTarget(null)
        }}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        baseUnits={baseUnits}
      />
    </div>
  )
}
