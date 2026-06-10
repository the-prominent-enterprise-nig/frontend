'use client'

import { useState } from 'react'
import { BarChart2, RefreshCw, X, AlertTriangle, Plus } from 'lucide-react'
import { useReorder } from '../_hooks/useReorder'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { ReorderRuleFormValues } from '@/src/schema/inventory/reorder'
import ReorderRuleModal from './ReorderRuleModal'

export default function ReorderDashboard({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.REORDER_MANAGE)
  const [isRuleOpen, setIsRuleOpen] = useState(false)
  const [editInitial, setEditInitial] = useState<Partial<ReorderRuleFormValues> | undefined>(
    undefined
  )

  const {
    rules,
    alerts,
    rulesPagination,
    isLoadingRules,
    isLoadingAlerts,
    isFetching,
    error,
    activeTab,
    setActiveTab,
    warehouseFilter,
    setWarehouseFilter,
    page,
    setPage,
    warehouseOptions,
    itemOptions,
    upsertRule,
    isUpserting,
    refetch,
  } = useReorder()

  function openCreate() {
    setEditInitial(undefined)
    setIsRuleOpen(true)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Reorder Management</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Monitor low-stock alerts and configure automatic reorder thresholds.
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
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Rule
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-zinc-200">
          {(['alerts', 'rules'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${activeTab === tab ? 'border-prominent-purple-700 text-prominent-purple-700' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
            >
              {tab === 'alerts' ? (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock Alerts
                  {alerts.length > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                      {alerts.length}
                    </span>
                  )}
                </span>
              ) : (
                'Reorder Rules'
              )}
            </button>
          ))}
        </div>

        {/* Warehouse filter */}
        <div className="flex gap-3">
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
          {warehouseFilter && (
            <button
              type="button"
              onClick={() => setWarehouseFilter(undefined)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load data</p>
          </div>
        )}

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          >
            {isLoadingAlerts ? (
              <div className="p-8 text-center text-sm text-zinc-400">Loading alerts…</div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart2 className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No low-stock alerts</p>
                <p className="mt-1 text-xs text-zinc-400">
                  All items are above their reorder points.
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
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                        Warehouse
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Current Qty
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Reorder Pt.
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Reorder Qty
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                        PR Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {alerts.map((alert, i) => (
                      <tr key={`${alert.itemId}-${i}`} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{alert.item?.name ?? '—'}</p>
                          {alert.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{alert.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {alert.warehouse?.code ?? 'All'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${alert.currentQty <= 0 ? 'text-red-600' : 'text-amber-600'}`}
                          >
                            {alert.currentQty}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600">
                          {alert.reorderPoint}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600">
                          {alert.reorderQuantity}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {alert.hasActivePr ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              Active PR
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                              No PR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rules tab */}
        {activeTab === 'rules' && (
          <div
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          >
            {isLoadingRules ? (
              <div className="p-8 text-center text-sm text-zinc-400">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BarChart2 className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No reorder rules configured</p>
                {canManage && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Add a rule to start auto-monitoring stock levels.
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
                        Reorder Pt.
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Reorder Qty
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                        Auto PR
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{rule.item?.name ?? '—'}</p>
                          {rule.item?.sku && (
                            <p className="font-mono text-xs text-zinc-400">{rule.item.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                          {rule.warehouse?.code ?? 'All'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-zinc-700">
                          {rule.reorderPoint}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-600">
                          {rule.reorderQuantity}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {rule.autoCreatePr ? (
                            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              On
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                              Off
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rulesPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-sm text-zinc-500">
                <span>
                  Page {page} of {rulesPagination.totalPages}
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
                    onClick={() => setPage(Math.min(rulesPagination.totalPages, page + 1))}
                    disabled={page >= rulesPagination.totalPages}
                    className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ReorderRuleModal
        isOpen={isRuleOpen}
        onClose={() => setIsRuleOpen(false)}
        onSubmit={upsertRule}
        isSubmitting={isUpserting}
        items={itemOptions}
        warehouses={warehouseOptions}
        initial={editInitial}
      />
    </div>
  )
}
