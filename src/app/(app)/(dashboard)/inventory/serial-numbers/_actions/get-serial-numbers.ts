'use server'

import { api } from '@/src/libs/api/client'
import type { SerialNumberListResponse } from '@/src/schema/inventory/serial-numbers'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  status?: string
  search?: string
}

export async function getSerialNumbers(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    status: params.status,
    search: params.search,
  }

  return api.get<SerialNumberListResponse>('/inventory/serial-numbers', query)
}
