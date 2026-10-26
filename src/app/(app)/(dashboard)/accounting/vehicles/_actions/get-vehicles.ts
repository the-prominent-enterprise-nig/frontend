'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  VehicleListResponseSchema,
  type VehicleCategory,
  type VehicleListResponse,
} from '@/src/schema/inventory/vehicles'

type Params = {
  q?: string
  branchId?: string
  category?: VehicleCategory
  page?: number
  limit?: number
}

export async function getVehicles(params: Params = {}): Promise<ApiResponse<VehicleListResponse>> {
  const result = await api.get<VehicleListResponse>(
    '/inventory/vehicles/list',
    { ...params },
    { tags: ['inventory-vehicles'] }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch vehicles',
      message: result.message,
    }
  }

  const validated = VehicleListResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
