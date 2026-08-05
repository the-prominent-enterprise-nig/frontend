'use server'

import { api } from '@/src/libs/api/client'
import type { AdjustmentListResponse } from '@/src/schema/inventory/adjustments'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  reasonCode?: string
  status?: string
}

export async function getAdjustments(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    reasonCode: params.reasonCode,
    status: params.status,
  }

  return api.get<AdjustmentListResponse>('/inventory/adjustments', query)
}
