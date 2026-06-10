'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  FlatCategoryListResponse,
  FlatCategoryListResponseSchema,
} from '@/src/schema/inventory/categories'

export async function getCategoriesFlat(params?: {
  page?: number
  limit?: number
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<FlatCategoryListResponse>> {
  try {
    const result = await api.get<FlatCategoryListResponse>('/inventory/categories', {
      ...params,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories',
        message: result.message,
      }
    }

    const validated = FlatCategoryListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as FlatCategoryListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return {
      success: false,
      error: 'Failed to fetch categories',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
