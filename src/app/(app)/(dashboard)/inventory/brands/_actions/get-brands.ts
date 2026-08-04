'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  ItemClassificationListResponseSchema,
  ItemClassification,
} from '@/src/schema/inventory/classification'

export async function getBrands(): Promise<ApiResponse<ItemClassification[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/brands',
      {},
      { tags: ['inventory-item-brands'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch brands',
        message: result.message,
      }
    }

    const validated = ItemClassificationListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as ItemClassification[] }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching brands:', error)
    return {
      success: false,
      error: 'Failed to fetch brands',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
