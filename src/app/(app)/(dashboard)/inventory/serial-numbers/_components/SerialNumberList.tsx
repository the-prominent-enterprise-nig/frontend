'use client'

import { useState } from 'react'
import { Hash, RefreshCw, X } from 'lucide-react'
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

const statusOptions = SerialStatusSchema.options

export default function SerialNumberList({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.SERIAL_MANAGE)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)

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
    registerSerials,
    isRegistering,
    refetch,
  } = useSerialNumbers()

  const hasFilters = statusFilter || itemFilter || warehouseFilter || search

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

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value || undefined)}
            placeholder="Search serial numbers…"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 min-w-[200px]"
          />
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as SerialStatus | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {SERIAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={itemFilter ?? ''}
            onChange={(e) => setItemFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Items</option>
            {itemOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} — {item.name}
              </option>
            ))}
          </select>
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
              <Hash className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No serial numbers found</p>
              {canManage && (
                <p className="mt-1 text-xs text-zinc-400">
                  Register serials to enable unit-level traceability.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Serial #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Warehouse
                    </th>
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
                    <tr key={serial.id} className="hover:bg-zinc-50">
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
                        {serial.warehouse?.code ?? '—'}
                      </td>
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
