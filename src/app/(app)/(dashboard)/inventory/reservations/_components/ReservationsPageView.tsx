'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Package } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useReservations } from '../_hooks/useReservations'
import ReservationModal from './ReservationModal'
import type { ReservationFormValues } from '@/src/schema/inventory/reservations'

function statusBadge(status?: string | null) {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'released') return 'bg-zinc-100 text-zinc-500'
  if (status === 'expired') return 'bg-red-100 text-red-600'
  return 'bg-blue-100 text-blue-700'
}

function formatDateTime(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

export default function ReservationsPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.RESERVATIONS_CREATE)
  const canRelease = hasPermission(session, INVENTORY_PERMISSIONS.RESERVATIONS_RELEASE)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    reservations,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    itemOptions,
    warehouseOptions,
    createReservation,
    isCreating,
    releaseReservation,
    isReleasing,
    releasingId,
    refetch,
  } = useReservations()

  async function handleSubmit(data: ReservationFormValues) {
    const result = await createReservation(data)
    if (result.success) refetch()
    return result
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Reservations</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage stock reserved against sales orders and quotations.
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
                New Reservation
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load reservations</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading reservations…</div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No reservations found</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a reservation to hold stock for an order.
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
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Expires At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    {canRelease && (
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{res.item?.name ?? '—'}</p>
                        {res.item?.sku && (
                          <p className="font-mono text-xs text-zinc-400">{res.item.sku}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                        {res.warehouse?.code ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-zinc-700">
                        {res.reservedQty}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <p className="text-zinc-900 capitalize">
                          {res.referenceType.replace('_', ' ')}
                        </p>
                        <p className="font-mono text-xs text-zinc-400">{res.referenceId}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                        {formatDateTime(res.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge(res.status)}`}
                        >
                          {res.status ?? 'active'}
                        </span>
                      </td>
                      {canRelease && (
                        <td className="px-4 py-3 text-center">
                          {res.status !== 'released' && (
                            <button
                              type="button"
                              onClick={() => releaseReservation(res.id)}
                              disabled={isReleasing && releasingId === res.id}
                              className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                            >
                              Release
                            </button>
                          )}
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

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        items={itemOptions}
        warehouses={warehouseOptions}
      />
    </div>
  )
}
