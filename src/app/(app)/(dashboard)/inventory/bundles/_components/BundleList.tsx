'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Search, X, Layers } from 'lucide-react'
import { useBundleManager } from '../_hooks/useBundleManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { ItemSummary } from '@/src/schema/inventory/items'
import CreateBundleModal from './CreateBundleModal'
import BundleDetailModal from './BundleDetailModal'

export default function BundleList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.BUNDLES_CREATE)

  const {
    bundles,
    pagination,
    isLoading,
    isFetching,
    error,
    search,
    setSearch,
    page,
    setPage,
    selectedBundle,
    setSelectedBundle,
    bundleComponents,
    bundleAvailableQty,
    isLoadingComponents,
    itemOptions,
    categoryOptions,
    uomOptions,
    createBundle,
    isCreating,
    refetch,
  } = useBundleManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput || undefined)
  }

  function clearSearch() {
    setSearchInput('')
    setSearch(undefined)
  }

  function openDetail(bundle: ItemSummary) {
    setSelectedBundle(bundle)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Bundle Kits</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Items that combine multiple component SKUs into a single sellable unit. Click{' '}
              <span className="font-medium text-zinc-700">View</span> to see a bundle&apos;s
              components and availability.
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
                New Bundle
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or SKU…"
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
              onClick={clearSearch}
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
            <p className="text-sm font-medium text-red-800">Failed to load bundles</p>
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
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Layers className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No items found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a bundle to combine multiple SKUs into a single sellable kit.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Bundle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Selling Price
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
                  {bundles.map((bundle) => (
                    <tr key={bundle.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              bundle.isBundle === true ? 'bg-prominent-purple-50' : 'bg-zinc-100'
                            }`}
                          >
                            <Layers
                              className={`h-4 w-4 ${
                                bundle.isBundle === true
                                  ? 'text-prominent-purple-600'
                                  : 'text-zinc-400'
                              }`}
                            />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-zinc-900">{bundle.name}</p>
                              {bundle.isBundle === true && (
                                <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                                  Bundle
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-xs text-zinc-400">{bundle.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                        {bundle.primaryCategory?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 hidden md:table-cell">
                        {bundle.sellingPrice != null
                          ? bundle.sellingPrice.toLocaleString('en-PH', {
                              style: 'currency',
                              currency: 'PHP',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            bundle.lifecycle === 'active' || !bundle.lifecycle
                              ? 'bg-green-100 text-green-700'
                              : bundle.lifecycle === 'discontinued'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {bundle.lifecycle ?? 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(bundle)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
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
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} bundles
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

      <CreateBundleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createBundle}
        isSubmitting={isCreating}
        itemOptions={itemOptions}
        categoryOptions={categoryOptions}
        uomOptions={uomOptions}
      />

      <BundleDetailModal
        isOpen={!!selectedBundle}
        bundle={selectedBundle}
        components={bundleComponents}
        availableQty={bundleAvailableQty}
        isLoading={isLoadingComponents}
        onClose={() => setSelectedBundle(null)}
      />
    </div>
  )
}
