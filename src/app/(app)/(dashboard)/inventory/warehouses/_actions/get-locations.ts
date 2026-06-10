'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { LocationSummary, LocationListResponseSchema } from '@/src/schema/inventory/warehouses'

export async function getLocations(warehouseId: string): Promise<ApiResponse<LocationSummary[]>> {
  if (!warehouseId) {
    return { success: false, error: 'Invalid warehouse ID', message: 'Warehouse ID is required' }
  }

  try {
    const result = await api.get<LocationSummary[]>(
      `/inventory/warehouses/${warehouseId}/locations`,
      undefined,
      { tags: [`inventory-warehouse-${warehouseId}-locations`] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch locations',
        message: result.message,
      }
    }

    const validated = LocationListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as LocationSummary[] }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching locations:', error)
    return {
      success: false,
      error: 'Failed to fetch locations',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
