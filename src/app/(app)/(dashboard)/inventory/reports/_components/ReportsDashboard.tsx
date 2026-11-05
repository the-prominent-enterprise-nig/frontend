'use client'

import type { ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { InventoryTabNav, type InventoryTab } from '@/src/components/inventory/InventoryTabNav'
import { useInventoryReports } from '../_hooks/useInventoryReports'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import StockCountList from '../../stock-counts/_components/StockCountList'
import AgingReport from './AgingReport'

export const STOCK_REPORT_TABS = {
  aging: 'aging',
  physicalInventory: 'physical-inventory',
} as const

/** The Stock Report's tabs this user may open, each gated by the permission
 * its backend endpoints require (Scenario 87). */
function visibleTabs(session: SessionUser): InventoryTab[] {
  const tabs: InventoryTab[] = []
  if (can(session, INVENTORY_PERMISSIONS.REPORTS_TURNOVER)) {
    tabs.push({ id: STOCK_REPORT_TABS.aging, label: 'Aging of Inventory' })
  }
  if (can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_READ)) {
    tabs.push({ id: STOCK_REPORT_TABS.physicalInventory, label: 'Physical Inventory' })
  }
  return tabs
}

/** Mounted only while its tab is open, so its queries don't run otherwise. */
function AgingTab(): ReactElement {
  const {
    page,
    setPage,
    agingFilters,
    applyAgingFilters,
    warehouseOptions,
    agingData,
    isAgingLoading,
    isAgingFetching,
    typeOptions,
  } = useInventoryReports()

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <AgingReport
          data={agingData}
          isLoading={isAgingLoading}
          isFetching={isAgingFetching}
          page={page}
          setPage={setPage}
          filters={agingFilters}
          onFiltersChange={applyAgingFilters}
          warehouses={warehouseOptions}
          typeOptions={typeOptions}
        />
      </div>
    </div>
  )
}

export default function ReportsDashboard({ session }: { session: SessionUser }): ReactElement {
  const tabs = visibleTabs(session)
  const requested = useSearchParams().get('tab')
  const active = tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {tabs.length > 1 && <InventoryTabNav tabs={tabs} />}
      {active === STOCK_REPORT_TABS.physicalInventory ? (
        <StockCountList session={session} />
      ) : active === STOCK_REPORT_TABS.aging ? (
        <AgingTab />
      ) : null}
    </div>
  )
}
