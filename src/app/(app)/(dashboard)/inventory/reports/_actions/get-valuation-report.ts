'use server'

import { api } from '@/src/libs/api/client'
import type { ValuationReportResponse } from '@/src/schema/inventory/reports'

type Params = {
  warehouseId?: string
  categoryId?: string
  search?: string
  page?: number
  limit?: number
}

export async function getValuationReport(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    search: params.search,
    page: params.page,
    limit: params.limit,
  }

  return api.get<ValuationReportResponse>('/inventory/reports/valuation', query, {
    tags: ['inventory-report-valuation'],
  })
}
