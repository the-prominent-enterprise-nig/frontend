'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { VehicleListResponseSchema, type VehicleSummary } from '@/src/schema/inventory/vehicles'

type Params = {
  q?: string
  branchId?: string
}

export async function searchVehicles(params: Params = {}): Promise<ApiResponse<VehicleSummary[]>> {
  const result = await api.get<VehicleSummary[]>('/inventory/vehicles', {
    q: params.q,
    branchId: params.branchId,
  })

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch vehicles',
      message: result.message,
    }
  }

  const validated = VehicleListResponseSchema.safeParse(result.data)
  if (!validated.success) {
    return { success: true, data: result.data }
  }

  return { success: true, data: validated.data }
}
