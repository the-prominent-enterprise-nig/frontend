'use server'

import { api } from '@/src/libs/api/client'
import type { ReorderRuleListResponse } from '@/src/schema/inventory/reorder'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
}

export async function getReorderRules(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  }

  return api.get<ReorderRuleListResponse>('/inventory/stock/reorder-rules', query)
}
