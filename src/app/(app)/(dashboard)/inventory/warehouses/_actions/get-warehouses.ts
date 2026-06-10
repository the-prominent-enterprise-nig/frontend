'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  WarehouseListResponse,
  WarehouseListResponseSchema,
} from '@/src/schema/inventory/warehouses'

export async function getWarehouses(params?: {
  page?: number
  limit?: number
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<WarehouseListResponse>> {
  try {
    const result = await api.get<WarehouseListResponse>(
      '/inventory/warehouses',
      {
        ...params,
      },
      { tags: ['inventory-warehouses'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch warehouses',
        message: result.message,
      }
    }

    const validated = WarehouseListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as WarehouseListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return {
      success: false,
      error: 'Failed to fetch warehouses',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
