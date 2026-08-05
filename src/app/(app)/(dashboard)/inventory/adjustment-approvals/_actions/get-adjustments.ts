'use server'

import { api } from '@/src/libs/api/client'
import type { AdjustmentListResponse, AdjustmentStatus } from '@/src/schema/inventory/adjustments'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  status?: AdjustmentStatus
}

export async function getAdjustments(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    status: params.status,
  }

  return api.get<AdjustmentListResponse>('/inventory/adjustments', query)
}
