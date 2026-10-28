'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  VehicleExpensesResponseSchema,
  type VehicleExpensesResponse,
} from '@/src/schema/inventory/vehicles'

type Params = {
  /** Period covered, inclusive — YYYY-MM-DD, on the expense date. */
  from?: string
  to?: string
  page?: number
  limit?: number
}

// The Fuel / Vehicle Repair lines recorded against one plate, for the vehicle's
// read-only expenses view. Gated on accounting:expense:read by the API.
export async function getVehicleExpenses(
  vehicleId: string,
  params: Params = {}
): Promise<ApiResponse<VehicleExpensesResponse>> {
  const result = await api.get<VehicleExpensesResponse>(
    `/expenses/vehicles/${vehicleId}/expenses`,
    { ...params },
    { tags: ['inventory-vehicles', 'accounting-expenses'] }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch vehicle expenses',
      message: result.message,
    }
  }

  const validated = VehicleExpensesResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
