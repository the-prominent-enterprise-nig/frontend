'use client'

import { useState } from 'react'
import { Plus, RefreshCw, TruckIcon } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useLandedCosts } from '../_hooks/useLandedCosts'
import LandedCostModal from './LandedCostModal'
import type { LandedCostFormValues } from '@/src/schema/inventory/landed-cost'

function allocationMethodLabel(method: string) {
  const map: Record<string, string> = {
    by_quantity: 'By Quantity',
    by_value: 'By Value',
    by_weight: 'By Weight',
  }
  return map[method] ?? method
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString()
  } catch {
    return date
  }
}

function formatCurrency(value?: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

export default function LandedCostPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.LANDED_COST_CREATE)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    landedCosts,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    goodsReceiptOptions,
    createLandedCost,
    isCreating,
    refetch,
  } = useLandedCosts()

  async function handleSubmit(data: LandedCostFormValues) {
    return createLandedCost(data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Landed Costs</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Record and allocate additional landed costs on goods receipts.
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
                Record Landed Cost
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load landed costs</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading landed costs…</div>
          ) : landedCosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <TruckIcon className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No landed costs recorded yet</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Record freight, duties, and other costs against goods receipts.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Goods Receipt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Allocation
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Total Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {landedCosts.map((lc) => (
                    <tr key={lc.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {lc.goodsReceipt?.code ??
                            lc.goodsReceipt?.receiptNumber ??
                            lc.goodsReceiptId}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                        {allocationMethodLabel(lc.allocationMethod)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-semibold text-zinc-700 md:table-cell">
                        {formatCurrency(lc.totalLandedCost)}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <p className="max-w-xs truncate text-zinc-600">{lc.notes ?? '—'}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                        {formatDate(lc.createdAt)}
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

      <LandedCostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        goodsReceipts={goodsReceiptOptions}
      />
    </div>
  )
}
