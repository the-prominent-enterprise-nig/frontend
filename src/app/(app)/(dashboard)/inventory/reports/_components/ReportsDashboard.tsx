'use client'

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
    page,
    setPage,
    agingFilters,
    applyAgingFilters,
    warehouseOptions,
    agingData,
    isAgingLoading,
    isAgingFetching,
    categoryOptions,
    typeOptions,
  } = useInventoryReports()

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {activeTab === 'aging' && canViewAging && (
          <AgingReport
            data={agingData}
            isLoading={isAgingLoading}
            isFetching={isAgingFetching}
            page={page}
            setPage={setPage}
            filters={agingFilters}
            onFiltersChange={applyAgingFilters}
            warehouses={warehouseOptions}
            categoryOptions={categoryOptions}
            typeOptions={typeOptions}
          />
        )}
      </div>
    </div>
  )
}
