'use server'

import { api } from '@/src/libs/api/client'
import type { ValuationReportResponse } from '@/src/schema/inventory/reports'

type Params = {
  warehouseId?: string
  categoryId?: string
  search?: string
}

export async function getValuationReport(params: Params = {}) {
  const query: Record<string, string | undefined> = {
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    search: params.search,
  }

  return api.get<ValuationReportResponse>('/inventory/reports/valuation', query, {
    tags: ['inventory-report-valuation'],
  })
}
