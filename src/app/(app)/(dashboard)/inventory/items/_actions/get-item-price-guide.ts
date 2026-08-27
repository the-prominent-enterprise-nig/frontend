'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { ItemPriceGuideSchema, type ItemPriceGuideEntry } from '@/src/schema/inventory/price-lists'

export async function getItemPriceGuide(
  itemId: string
): Promise<ApiResponse<ItemPriceGuideEntry[]>> {
  const result = await api.get(`/inventory/price-lists/for-item/${itemId}`)
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to fetch price guide' }
  }

  const parsed = ItemPriceGuideSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Unexpected response shape' }
  }

  return { success: true, data: parsed.data }
}
