'use client'

import { useState } from 'react'
import { RefreshCw, BarChart2, Settings, X } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useStockLevels } from '../_hooks/useStockLevels'
import type { ReorderRule, StockLevelFormValues } from '@/src/schema/inventory/reorder'

// ─── Modal ────────────────────────────────────────────────────────────────────

interface StockLevelModalProps {
  rule: ReorderRule
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: StockLevelFormValues) => Promise<unknown>
  isSubmitting: boolean
}

function StockLevelModal({ rule, isOpen, onClose, onSubmit, isSubmitting }: StockLevelModalProps) {
  const [minStockLevel, setMinStockLevel] = useState<string>(
    rule.minStockLevel != null ? String(rule.minStockLevel) : ''
  )
  const [maxStockLevel, setMaxStockLevel] = useState<string>(
    rule.maxStockLevel != null ? String(rule.maxStockLevel) : ''
  )
  const [safetyStock, setSafetyStock] = useState<string>(
    rule.safetyStock != null ? String(rule.safetyStock) : ''
  )
  const [reorderPoint, setReorderPoint] = useState<string>(String(rule.reorderPoint ?? 0))
  const [autoCreatePr, setAutoCreatePr] = useState<boolean>(rule.autoCreatePr ?? false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: StockLevelFormValues = {
      itemId: rule.item?.id ?? '',
      warehouseId: rule.warehouse?.id ?? null,
      reorderPoint: reorderPoint !== '' ? Number(reorderPoint) : 0,
      reorderQuantity: rule.reorderQuantity ?? 0,
      minStockLevel: minStockLevel !== '' ? Number(minStockLevel) : undefined,
      maxStockLevel: maxStockLevel !== '' ? Number(maxStockLevel) : undefined,
      safetyStock: safetyStock !== '' ? Number(safetyStock) : undefined,
      autoCreatePr,
    }

    await onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-lg">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Edit Stock Level Boundaries</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {/* Read-only context */}
          <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-zinc-500">Item</span>
              <span className="font-medium text-zinc-800">
                {rule.item?.name ?? '—'}
                {rule.item?.sku ? ` (${rule.item.sku})` : ''}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-zinc-500">Warehouse</span>
              <span className="text-zinc-700">{rule.warehouse?.name ?? 'All warehouses'}</span>
            </div>
          </div>

          {/* Min Stock Level */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="minStockLevel">
              Min Stock Level
            </label>
            <input
              id="minStockLevel"
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 10"
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>

          {/* Safety Stock */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="safetyStock">
              Safety Stock
            </label>
            <input
              id="safetyStock"
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 5"
              value={safetyStock}
              onChange={(e) => setSafetyStock(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>

          {/* Max Stock Level */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="maxStockLevel">
              Max Stock Level
            </label>
            <input
              id="maxStockLevel"
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 100"
              value={maxStockLevel}
              onChange={(e) => setMaxStockLevel(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>

          {/* Reorder Point */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="reorderPoint">
              Reorder Point
            </label>
            <input
              id="reorderPoint"
              type="number"
              min={0}
              step={1}
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>

          {/* Auto-create PR */}
          <div className="flex items-center gap-3">
            <input
              id="autoCreatePr"
              type="checkbox"
              checked={autoCreatePr}
              onChange={(e) => setAutoCreatePr(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
            />
            <label htmlFor="autoCreatePr" className="text-sm font-medium text-zinc-700">
              Auto-create purchase request when reorder point is reached
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save Boundaries'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page view ────────────────────────────────────────────────────────────────

export default function StockLevelsPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.STOCK_LEVELS_MANAGE)

  const {
    rules,
    pagination,
    isLoading,
    isFetching,
    selectedRule,
    setSelectedRule,
    upsertStockLevel,
    isUpserting,
    page,
    setPage,
    refetch,
  } = useStockLevels()

  const [isModalOpen, setIsModalOpen] = useState(false)

  function openEdit(rule: ReorderRule) {
    setSelectedRule(rule)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setSelectedRule(null)
  }

  async function handleSubmit(data: StockLevelFormValues) {
    await upsertStockLevel(data)
    closeModal()
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Stock Level Boundaries</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Configure minimum, safety, and maximum stock level boundaries per item and warehouse.
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
                onClick={() => {
                  if (rules.length > 0) {
                    openEdit(rules[0])
                  }
                }}
                disabled={rules.length === 0}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                <Settings className="h-4 w-4" />
                Set Boundaries
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading stock level rules…</div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart2 className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No reorder rules found</p>
              <p className="mt-1 text-xs text-zinc-400">
                Stock level boundaries are configured on top of reorder rules.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Min Stock
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                      Safety Stock
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Max Stock
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                      Reorder Point
                    </th>
                    {canManage && (
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{rule.item?.name ?? '—'}</p>
                        {rule.item?.sku && <p className="text-xs text-zinc-400">{rule.item.sku}</p>}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                        {rule.warehouse?.name ?? <span className="text-zinc-400 italic">All</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {rule.minStockLevel != null ? (
                          rule.minStockLevel
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-zinc-700 md:table-cell">
                        {rule.safetyStock != null ? (
                          rule.safetyStock
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {rule.maxStockLevel != null ? (
                          rule.maxStockLevel
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-zinc-600 lg:table-cell">
                        {rule.reorderPoint}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(rule)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
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

      {/* Edit Modal */}
      {selectedRule && (
        <StockLevelModal
          rule={selectedRule}
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isUpserting}
        />
      )}
    </div>
  )
}
