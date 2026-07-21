'use client'

import { Search, RefreshCw, X } from 'lucide-react'
import { useInventoryReports } from '../_hooks/useInventoryReports'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import ValuationReport from './ValuationReport'
import TurnoverReport from './TurnoverReport'

export default function ReportsDashboard({ session }: { session: SessionUser }) {
  const canViewValuation = hasPermission(session, INVENTORY_PERMISSIONS.REPORTS_VALUATION)
  const canViewTurnover = hasPermission(session, INVENTORY_PERMISSIONS.REPORTS_TURNOVER)

  const {
    tab: activeTab,
    setTab: setActiveTab,
    warehouseFilter,
    categoryFilter,
    search,
    setWarehouseFilter,
    setCategoryFilter,
    setSearch,
    resetFilters,
    page,
    setPage,
    valuationData,
    isValuationLoading,
    isValuationFetching,
    valuationError,
    refetchValuation,
    periodDays,
    setPeriodDays,
    statusFilter,
    setStatusFilter,
    turnoverData,
    isTurnoverLoading,
    isTurnoverFetching,
    turnoverError,
    refetchTurnover,
    warehouseOptions,
    categoryOptions,
  } = useInventoryReports()

  const hasFilters = !!warehouseFilter || !!categoryFilter || !!search
  const isFetching = activeTab === 'valuation' ? isValuationFetching : isTurnoverFetching
  const hasError = activeTab === 'valuation' ? valuationError : turnoverError

  function handleRefresh() {
    if (activeTab === 'valuation') refetchValuation()
    else refetchTurnover()
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Inventory Reports</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Stock valuation, turnover, and aging analysis.
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

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit shadow-sm">
          {canViewValuation && (
            <button
              type="button"
              onClick={() => setActiveTab('valuation')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'valuation'
                  ? 'bg-prominent-purple-700 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Stock Valuation
            </button>
          )}
          {canViewTurnover && (
            <button
              type="button"
              onClick={() => setActiveTab('turnover')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'turnover'
                  ? 'bg-prominent-purple-700 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Turnover & Aging
            </button>
          )}
        </div>

        {/* Shared Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <label htmlFor="report-search" className="sr-only">
              Search item
            </label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="report-search"
              type="text"
              placeholder="Search item…"
              aria-label="Search item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-prominent-purple-500"
            />
          </div>

          <label htmlFor="report-warehouse-filter" className="sr-only">
            Filter by warehouse
          </label>
          <select
            id="report-warehouse-filter"
            aria-label="Filter by warehouse"
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

          <label htmlFor="report-category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="report-category-filter"
            aria-label="Filter by category"
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load report data</p>
          </div>
        )}

        {/* Report Content */}
        {activeTab === 'valuation' && canViewValuation && (
          <ValuationReport
            data={valuationData}
            isLoading={isValuationLoading}
            isFetching={isValuationFetching}
            page={page}
            setPage={setPage}
          />
        )}

        {activeTab === 'turnover' && canViewTurnover && (
          <TurnoverReport
            data={turnoverData}
            isLoading={isTurnoverLoading}
            isFetching={isTurnoverFetching}
            periodDays={periodDays}
            setPeriodDays={setPeriodDays}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            page={page}
            setPage={setPage}
          />
        )}
      </div>
    </div>
  )
}
