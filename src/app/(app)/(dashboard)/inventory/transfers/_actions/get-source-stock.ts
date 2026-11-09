'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export type SourceStockItem = {
  itemId: string
  name: string
  sku: string
  availableQty: number
}

// Stock request item picker: items in stock at the request's source
// warehouse. Unlike /inventory/stock/balances this isn't locked to the
// caller's own branch — a request's source is another branch.
export async function getSourceStock(
  warehouseId: string,
  search?: string
): Promise<ApiResponse<SourceStockItem[]>> {
  try {
    const params = new URLSearchParams({ warehouseId })
    if (search?.trim()) params.set('search', search.trim())
    return await api.get<SourceStockItem[]>(
      `/inventory/transfers/source-stock?${params.toString()}`
    )
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch source stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
