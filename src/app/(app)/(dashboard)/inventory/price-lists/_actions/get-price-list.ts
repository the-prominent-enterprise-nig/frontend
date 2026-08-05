'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { PriceListDetailSchema, type PriceListDetail } from '@/src/schema/inventory/price-lists'

export async function getPriceList(id: string): Promise<ApiResponse<PriceListDetail>> {
  const result = await api.get(`/inventory/price-lists/${id}`)
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to fetch price list' }
  }

  const parsed = PriceListDetailSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Unexpected response shape' }
  }

  return { success: true, data: parsed.data }
}
