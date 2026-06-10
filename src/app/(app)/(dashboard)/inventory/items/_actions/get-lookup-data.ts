'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  CategoryOption,
  CategoryListResponseSchema,
  UomOption,
  UomListResponseSchema,
} from '@/src/schema/inventory/items'

export async function getCategories(params?: {
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<{ data: CategoryOption[] }>> {
  try {
    const result = await api.get(
      '/inventory/categories',
      {
        status: params?.status ?? 'active',
        limit: 200,
        ...params,
      },
      {
        tags: ['inventory-categories'],
      }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories',
        message: result.message,
      }
    }

    const validated = CategoryListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as { data: CategoryOption[] } }
    }

    return { success: true, data: validated.data as { data: CategoryOption[] } }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return {
      success: false,
      error: 'Failed to fetch categories',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getUnitsOfMeasure(params?: {
  search?: string
}): Promise<ApiResponse<{ data: UomOption[] }>> {
  try {
    const result = await api.get(
      '/inventory/uom',
      {
        limit: 200,
        ...params,
      },
      {
        tags: ['inventory-uom'],
      }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch UOM',
        message: result.message,
      }
    }

    const validated = UomListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as { data: UomOption[] } }
    }

    return { success: true, data: validated.data as { data: UomOption[] } }
  } catch (error) {
    console.error('Error fetching units of measure:', error)
    return {
      success: false,
      error: 'Failed to fetch units of measure',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
