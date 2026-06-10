'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Tag } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { usePriceLists } from '../_hooks/usePriceLists'
import PriceListModal from './PriceListModal'
import type { PriceListFormValues } from '@/src/schema/inventory/price-lists'

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'inactive') return 'bg-zinc-100 text-zinc-500'
  return 'bg-amber-100 text-amber-700'
}

function listTypeBadge(type: string) {
  const map: Record<string, string> = {
    standard: 'bg-blue-100 text-blue-700',
    promotional: 'bg-pink-100 text-pink-700',
    contract: 'bg-violet-100 text-violet-700',
    wholesale: 'bg-teal-100 text-teal-700',
  }
  return map[type] ?? 'bg-zinc-100 text-zinc-500'
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

export default function PriceListsPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_CREATE)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    priceLists,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    currencies,
    createPriceList,
    isCreating,
    refetch,
  } = usePriceLists()

  async function handleSubmit(data: PriceListFormValues) {
    return createPriceList(data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Price Lists</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage pricing tiers for your inventory items.
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
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Price List
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load price lists</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading price lists…</div>
          ) : priceLists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Tag className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No price lists yet</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a price list to define pricing tiers for your items.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Currency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Effective From
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Effective To
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {priceLists.map((pl) => (
                    <tr key={pl.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{pl.name}</p>
                        {pl.description && (
                          <p className="max-w-xs truncate text-xs text-zinc-400">
                            {pl.description}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${listTypeBadge(pl.listType)}`}
                        >
                          {pl.listType}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                        {pl.currency}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(pl.status)}`}
                        >
                          {pl.status}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                        {formatDate(pl.effectiveFrom)}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                        {formatDate(pl.effectiveTo)}
                      </td>
                      <td className="hidden px-4 py-3 text-center text-zinc-600 md:table-cell">
                        {pl.priority}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {page} of {pagination.totalPages}
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
      </div>

      <PriceListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        currencies={currencies}
      />
    </div>
  )
}
