'use server'

import { api } from '@/src/libs/api/client'
import type { ManualReceivingReportListResponse } from '@/src/schema/inventory/manual-receiving-reports'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  status?: string
}

export async function getManualReceivingReports(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    status: params.status,
  }

  return api.get<ManualReceivingReportListResponse>('/inventory/manual-receiving-reports', query)
}
