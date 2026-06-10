'use client'

import { useState } from 'react'
import { PackageMinus, TrendingUp, RefreshCw } from 'lucide-react'
import { useCosting } from '../_hooks/useCosting'
import ValuationTable from './ValuationTable'
import IssueStockModal from './IssueStockModal'
import type { SessionUser } from '@/src/libs/guards/permission'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

type Tab = 'valuation' | 'issue'

export default function CostingPageView({ session }: { session: SessionUser }) {
  const canConfigure = hasPermission(session, INVENTORY_PERMISSIONS.COSTING_CONFIGURE)
  const canRead = hasPermission(session, INVENTORY_PERMISSIONS.COSTING_READ)
  const canIssue = hasPermission(session, INVENTORY_PERMISSIONS.STOCKS_CREATE)

  const [tab, setTab] = useState<Tab>('valuation')
  const [showIssueModal, setShowIssueModal] = useState(false)

  const {
    valuation,
    isLoadingValuation,
    isFetchingValuation,
    warehouseFilter,
    setWarehouseFilter,
    warehouseOptions,
    itemOptions,
    issueStock,
    isIssuing,
    previewCogs,
    refetch,
  } = useCosting()

  const tabs: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'valuation', label: 'Stock Valuation', icon: TrendingUp },
  ]

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Costing & COGS</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Stock valuation based on actual cost layers (FIFO / LIFO / Weighted Average).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refetch}
              disabled={isFetchingValuation}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingValuation ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canIssue && (
              <button
                type="button"
                onClick={() => setShowIssueModal(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <PackageMinus className="h-4 w-4" />
                Issue Stock
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-prominent-purple-700 text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Valuation tab */}
        {(tab === 'valuation' || tabs.length === 1) && canRead && (
          <ValuationTable
            valuation={valuation}
            isLoading={isLoadingValuation}
            isFetching={isFetchingValuation}
            warehouseFilter={warehouseFilter}
            warehouseOptions={warehouseOptions}
            onWarehouseChange={setWarehouseFilter}
            onRefresh={refetch}
          />
        )}

        {/* Permission notice */}
        {!canRead && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">
              You don&apos;t have permission to view costing data. Contact a Finance Manager.
            </p>
          </div>
        )}

        {/* Per-item override note for Finance Managers */}
        {canConfigure && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-800">Per-Item Costing Method</h3>
            <p className="mt-1 text-xs text-zinc-500">
              To override the costing method for a specific item, go to{' '}
              <a
                href="/inventory/items"
                className="text-prominent-purple-600 underline underline-offset-2"
              >
                Item Master
              </a>
              , open the item, and edit the Costing Method field. Overrides are only available when
              enabled in{' '}
              <a
                href="/inventory/settings"
                className="text-prominent-purple-600 underline underline-offset-2"
              >
                Inventory Settings
              </a>
              .
            </p>
          </div>
        )}
      </div>

      {/* Issue stock modal */}
      {showIssueModal && (
        <IssueStockModal
          onClose={() => setShowIssueModal(false)}
          onIssue={issueStock}
          onPreview={previewCogs}
          isIssuing={isIssuing}
          itemOptions={itemOptions}
          warehouseOptions={warehouseOptions}
        />
      )}
    </div>
  )
}
