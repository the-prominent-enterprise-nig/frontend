'use client'

import { useState } from 'react'
import { Plus, RefreshCw, ClipboardList } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useBackorders } from '../_hooks/useBackorders'
import BackorderModal from './BackorderModal'
import BackorderUpdateModal from './BackorderUpdateModal'
import type {
  BackorderFormValues,
  BackorderUpdateFormValues,
  Backorder,
} from '@/src/schema/inventory/backorders'

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    partially_fulfilled: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-green-100 text-green-700',
    cancelled: 'bg-zinc-100 text-zinc-500',
  }
  return map[status] ?? 'bg-zinc-100 text-zinc-500'
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString()
  } catch {
    return date
  }
}

export default function BackordersPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.BACKORDERS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.BACKORDERS_UPDATE)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editBackorder, setEditBackorder] = useState<Backorder | null>(null)

  const {
    backorders,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    itemOptions,
    createBackorder,
    isCreating,
    updateBackorder,
    isUpdating,
    refetch,
  } = useBackorders()

  async function handleCreate(data: BackorderFormValues) {
    return createBackorder(data)
  }

  async function handleUpdate(data: BackorderUpdateFormValues) {
    if (!editBackorder) return { success: false as const, error: 'No backorder selected' }
    return updateBackorder({ id: editBackorder.id, data })
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Backorders</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track and manage backorder records for out-of-stock items.
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
                New Backorder
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load backorders</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading backorders…</div>
          ) : backorders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No backorders found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a backorder for items that cannot be fulfilled immediately.
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
                      Sales Order
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Backordered
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Commitment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Expected Fulfil
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    {canUpdate && (
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {backorders.map((bo) => (
                    <tr key={bo.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{bo.item?.name ?? '—'}</p>
                        {bo.item?.sku && (
                          <p className="font-mono text-xs text-zinc-400">{bo.item.sku}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                        <p>{bo.salesOrderId}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-zinc-700">
                        {bo.backorderedQty}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                        {formatDate(bo.commitmentDate)}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                        {formatDate(bo.expectedFulfillAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(bo.status)}`}
                        >
                          {bo.status.replace('_', ' ')}
                        </span>
                      </td>
                      {canUpdate && (
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setEditBackorder(bo)}
                            className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                          >
                            Update
                          </button>
                        </td>
                      )}
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

      <BackorderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        items={itemOptions}
      />

      <BackorderUpdateModal
        isOpen={editBackorder !== null}
        onClose={() => setEditBackorder(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        backorder={editBackorder}
      />
    </div>
  )
}
