'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PriceMakerInput, PriceMakerResult } from '@/src/schema/pos/price-maker'

export async function getPriceMaker(
  input: PriceMakerInput
): Promise<ApiResponse<PriceMakerResult>> {
  try {
    const result = await api.get<PriceMakerResult>('/pos/price-maker', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to compute the price' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to compute the price' }
  }
}
