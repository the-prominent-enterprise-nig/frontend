'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  TransferListResponse,
  TransferListResponseSchema,
  TransferStatus,
} from '@/src/schema/inventory/transfers'

export async function getTransfers(params?: {
  page?: number
  limit?: number
  status?: TransferStatus
  fromWarehouseId?: string
  toWarehouseId?: string
  branchId?: string
  search?: string
  /** Scenario 56 — multi-select From / To (warehouse ids). */
  fromWarehouseIds?: string[]
  toWarehouseIds?: string[]
  /** Scenario 56 — only transfers carrying this item (Item 360 Movements' Open transfers). */
  itemId?: string
}): Promise<ApiResponse<TransferListResponse>> {
  try {
    const result = await api.get<TransferListResponse>(
      '/inventory/transfers',
      {
        ...params,
        fromWarehouseIds: params?.fromWarehouseIds?.length
          ? params.fromWarehouseIds.join(',')
          : undefined,
        toWarehouseIds: params?.toWarehouseIds?.length
          ? params.toWarehouseIds.join(',')
          : undefined,
      },
      { tags: ['inventory-transfers'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch transfers',
        message: result.message,
      }
    }

    const validated = TransferListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as TransferListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return {
      success: false,
      error: 'Failed to fetch transfers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
