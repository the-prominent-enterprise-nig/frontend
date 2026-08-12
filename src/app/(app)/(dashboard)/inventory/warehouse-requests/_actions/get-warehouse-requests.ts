'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  WarehouseRequestListResponse,
  WarehouseRequestListResponseSchema,
  WarehouseRequestStatus,
  WarehouseRequestDirection,
} from '@/src/schema/inventory/warehouse-requests'

export async function getWarehouseRequests(params?: {
  page?: number
  limit?: number
  status?: WarehouseRequestStatus
  direction?: WarehouseRequestDirection
  warehouseId?: string
  branchId?: string
  search?: string
}): Promise<ApiResponse<WarehouseRequestListResponse>> {
  try {
    const result = await api.get<WarehouseRequestListResponse>(
      '/inventory/warehouse-requests',
      {
        ...params,
      },
      { tags: ['inventory-warehouse-requests'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch warehouse requests',
        message: result.message,
      }
    }

    const validated = WarehouseRequestListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as WarehouseRequestListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching warehouse requests:', error)
    return {
      success: false,
      error: 'Failed to fetch warehouse requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
