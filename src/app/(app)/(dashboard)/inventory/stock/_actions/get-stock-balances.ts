'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  StockBalanceListResponseSchema,
  type StockBalanceListResponse,
} from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  categoryId?: string
  search?: string
  belowReorder?: boolean
}

export async function getStockBalances(
  params: Params = {}
): Promise<ApiResponse<StockBalanceListResponse>> {
  const query: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    search: params.search,
    // Backend's StockBalanceFilterDto field is `belowReorderPoint` — this was
    // previously sent as `belowReorder`, which the DTO silently ignores (no
    // validation error, just never bound), so the "Below Reorder" toggle had
    // no effect at all.
    belowReorderPoint: params.belowReorder,
  }

  const result = await api.get<StockBalanceListResponse>('/inventory/stock/balances', query, {
    tags: ['inventory-stock-balances'],
  })

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch stock balances',
      message: result.message,
    }
  }

  const validated = StockBalanceListResponseSchema.safeParse(result.data)
  if (!validated.success) {
    // Return raw data if shape differs slightly — backend evolves independently
    return { success: true, data: result.data as StockBalanceListResponse }
  }

  return { success: true, data: validated.data }
}
