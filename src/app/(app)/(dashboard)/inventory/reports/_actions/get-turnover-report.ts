'use server'

import { api } from '@/src/libs/api/client'
import type { TurnoverReportResponse } from '@/src/schema/inventory/reports'

type Params = {
  periodDays?: number
  categoryId?: string
  warehouseId?: string
  search?: string
  status?: 'healthy' | 'slow_moving' | 'dead_stock'
}

export async function getTurnoverReport(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    periodDays: params.periodDays,
    categoryId: params.categoryId,
    warehouseId: params.warehouseId,
    search: params.search,
    status: params.status,
  }

  return api.get<TurnoverReportResponse>('/inventory/reports/turnover', query, {
    tags: ['inventory-report-turnover'],
  })
}
