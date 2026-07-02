'use server'

import { api } from '@/src/libs/api/client'
import type { ReceivingReportListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  branchId?: string
  status?: string
  startDate?: string
  endDate?: string
  hasDiscrepancy?: boolean
}

export async function getReceivingReports(params: Params = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    branchId: params.branchId,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    hasDiscrepancy: params.hasDiscrepancy,
  }

  return api.get<ReceivingReportListResponse>('/inventory/stock/receiving-reports', query)
}
