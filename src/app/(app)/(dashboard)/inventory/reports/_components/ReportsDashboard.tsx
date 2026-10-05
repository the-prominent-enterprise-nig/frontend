'use client'

import { RefreshCw } from 'lucide-react'
import { useInventoryReports } from '../_hooks/useInventoryReports'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import AgingReport from './AgingReport'

export default function ReportsDashboard({ session }: { session: SessionUser }) {
  // The Stock Report is the aging report only. It is gated by the turnover
  // permission on the backend (@RequirePermissions('inventory:reports:turnover')).
  const canViewAging = hasPermission(session, INVENTORY_PERMISSIONS.REPORTS_TURNOVER)

  const {
    tab: activeTab,
    categoryFilter,
    setCategoryFilter,
    page,
    setPage,
    refetchValuation,
    refetchTurnover,
    agingBucketFilter,
    setAgingBucketFilter,
    agingFilters,
    setAgingFilter,
    agingBrands,
    agingData,
    isAgingLoading,
    isAgingFetching,
    refetchAging,
    refetchReconciliation,
    categoryOptions,
  } = useInventoryReports()

  const isFetching = isAgingFetching

  function handleRefresh() {
    if (activeTab === 'valuation') refetchValuation()
    else if (activeTab === 'turnover') refetchTurnover()
    else if (activeTab === 'aging') refetchAging()
    else refetchReconciliation()
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Inventory Reports</h1>
            <p className="mt-1 text-sm text-zinc-500">
              How long each in-stock unit has been on hand.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {activeTab === 'aging' && canViewAging && (
          <AgingReport
            data={agingData}
            isLoading={isAgingLoading}
            isFetching={isAgingFetching}
            bucketFilter={agingBucketFilter}
            setBucketFilter={setAgingBucketFilter}
            filters={agingFilters}
            setFilter={setAgingFilter}
            brands={agingBrands}
            categoryId={categoryFilter}
            setCategoryId={setCategoryFilter}
            categoryOptions={categoryOptions}
            page={page}
            setPage={setPage}
            exportParams={{
              categoryId: categoryFilter || undefined,
              bucket: agingBucketFilter,
              serialNumber: agingFilters.serial,
              brandId: agingFilters.brandId,
              model: agingFilters.model,
              receivedFrom: agingFilters.receivedFrom,
              receivedTo: agingFilters.receivedTo,
            }}
          />
        )}
      </div>
    </div>
  )
}
