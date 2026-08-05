'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  ItemClassificationListResponseSchema,
  ItemClassification,
} from '@/src/schema/inventory/classification'

export async function getTypes(): Promise<ApiResponse<ItemClassification[]>> {
  try {
    const result = await api.get(
      '/inventory/classification/types',
      {},
      { tags: ['inventory-item-types'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item types',
        message: result.message,
      }
    }

    const validated = ItemClassificationListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as ItemClassification[] }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching item types:', error)
    return {
      success: false,
      error: 'Failed to fetch item types',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
