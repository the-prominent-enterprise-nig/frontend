'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  WarehouseRequestSummary,
  WarehouseRequestSummarySchema,
} from '@/src/schema/inventory/warehouse-requests'

export async function getWarehouseRequest(
  id: string
): Promise<ApiResponse<WarehouseRequestSummary>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  try {
    const result = await api.get<WarehouseRequestSummary>(`/inventory/warehouse-requests/${id}`)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch warehouse request',
        message: result.message,
      }
    }

    const validated = WarehouseRequestSummarySchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as WarehouseRequestSummary }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching warehouse request:', error)
    return {
      success: false,
      error: 'Failed to fetch warehouse request',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
