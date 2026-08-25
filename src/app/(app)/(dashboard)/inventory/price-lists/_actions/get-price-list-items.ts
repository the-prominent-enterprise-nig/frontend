'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  PriceListItemsPageSchema,
  type PriceListItemsPage,
} from '@/src/schema/inventory/price-lists'

type Params = {
  search?: string
  page?: number
  limit?: number
}

export async function getPriceListItems(
  priceListId: string,
  params: Params = {}
): Promise<ApiResponse<PriceListItemsPage>> {
  const result = await api.get(`/inventory/price-lists/${priceListId}/items`, {
    search: params.search,
    page: params.page,
    limit: params.limit,
  })

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to fetch price list items' }
  }

  const parsed = PriceListItemsPageSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Unexpected response shape' }
  }

  return { success: true, data: parsed.data }
}
