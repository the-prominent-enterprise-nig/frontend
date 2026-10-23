'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  DriverListResponseSchema,
  type DriverListResponse,
  type VehicleCategory,
} from '@/src/schema/inventory/vehicles'

type Params = {
  q?: string
  branchId?: string
  category?: VehicleCategory
  page?: number
  limit?: number
}

export async function getDrivers(params: Params = {}): Promise<ApiResponse<DriverListResponse>> {
  const result = await api.get<DriverListResponse>(
    '/inventory/vehicles/drivers',
    { ...params },
    { tags: ['inventory-drivers'] }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch drivers',
      message: result.message,
    }
  }

  const validated = DriverListResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
