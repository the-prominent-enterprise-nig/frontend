'use server'

import { api } from '@/src/libs/api/client'
import type { ReceivingReportListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  branchId?: string
  supplierId?: string
  search?: string
  status?: string
  startDate?: string
  endDate?: string
  hasDiscrepancy?: boolean
  /** Merges in Manual Receiving Reports alongside GoodsReceipts, sorted
   * together by date — opt-in so Inventory's own receiving list (which also
   * calls this action) is unaffected. */
  includeManual?: boolean
}

export async function getReceivingReports(params: Params = {}) {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    branchId: params.branchId,
    supplierId: params.supplierId,
    search: params.search,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    hasDiscrepancy: params.hasDiscrepancy,
    includeManual: params.includeManual,
  }

  return api.get<ReceivingReportListResponse>('/inventory/stock/receiving-reports', query)
}
