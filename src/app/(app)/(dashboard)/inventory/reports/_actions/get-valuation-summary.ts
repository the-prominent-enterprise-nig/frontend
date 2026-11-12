'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'

export type ValuationSummary = {
  summary: {
    totalItems: number
    totalQty: number
    totalValue: number
    byCategory: { category: string; totalValue: number; totalQty: number }[]
    byWarehouse: {
      warehouseId: string
      warehouseName: string
      totalValue: number
      totalQty: number
    }[]
  }
  generatedAt: string
}

/**
 * The Inventory dashboard's total amounts — valuation by category and
 * warehouse, with no per-item rows or cost, so custodians (who work without
 * item cost) can read it too. Scoped to the caller's branch server-side.
 */
export async function getValuationSummary(): Promise<ApiResponse<ValuationSummary>> {
  return api.get<ValuationSummary>('/inventory/reports/valuation/summary', undefined, {
    tags: ['inventory-report-valuation'],
  })
}
