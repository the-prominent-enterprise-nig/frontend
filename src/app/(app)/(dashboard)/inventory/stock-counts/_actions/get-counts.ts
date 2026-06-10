'use server'

import { api } from '@/src/libs/api/client'
import type { CountListResponse } from '@/src/schema/inventory/stock-counts'

type Params = {
  page?: number
  limit?: number
  warehouseId?: string
  countType?: string
  status?: string
}

export async function getCounts(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    warehouseId: params.warehouseId,
    countType: params.countType,
    status: params.status,
  }

  return api.get<CountListResponse>('/inventory/counts', query)
}
