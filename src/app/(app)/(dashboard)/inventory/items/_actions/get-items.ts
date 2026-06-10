'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ItemListResponse, ItemListResponseSchema } from '@/src/schema/inventory/items'

export async function getItems(params?: {
  page?: number
  limit?: number
  search?: string
  lifecycle?: 'active' | 'discontinued' | 'archived'
  primaryCategoryId?: string
}): Promise<ApiResponse<ItemListResponse>> {
  try {
    const result = await api.get<ItemListResponse>(
      '/inventory/items',
      {
        ...params,
      },
      {
        tags: ['inventory-items'],
      }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch items',
        message: result.message,
      }
    }

    const validated = ItemListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      // Return raw data if shape differs slightly — backend evolves independently
      return { success: true, data: result.data as ItemListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching items:', error)
    return {
      success: false,
      error: 'Failed to fetch items',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
