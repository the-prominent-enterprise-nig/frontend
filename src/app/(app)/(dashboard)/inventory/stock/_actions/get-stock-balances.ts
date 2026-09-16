'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  StockBalanceListResponseSchema,
  type StockBalanceListResponse,
  type StockStateFilter,
} from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  categoryId?: string
  search?: string
  // Scenario 50 — the Stock Balance screen's own filters. `branchIds` and
  // `warehouseIds` are the two halves of one "Branches" picker: a branch
  // carries its warehouses, the 2 standalone warehouses belong to no branch
  // at all. They OR together server-side.
  branchIds?: string[]
  warehouseIds?: string[]
  region?: 'panay' | 'negros'
  /** 'item' rolls every location into one row per item. */
  groupBy?: 'item'
  stockStatus?: StockStateFilter
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
    // Sent comma-separated; the DTO accepts either that or a repeated param.
    branchIds: params.branchIds?.length ? params.branchIds.join(',') : undefined,
    warehouseIds: params.warehouseIds?.length ? params.warehouseIds.join(',') : undefined,
    region: params.region,
    groupBy: params.groupBy,
    stockStatus: params.stockStatus,
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
