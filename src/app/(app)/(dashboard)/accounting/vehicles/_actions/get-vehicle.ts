'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { VehicleListItemSchema, type VehicleListItem } from '@/src/schema/inventory/vehicles'

export async function getVehicle(id: string): Promise<ApiResponse<VehicleListItem>> {
  const result = await api.get<VehicleListItem>(`/inventory/vehicles/${id}`)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch vehicle',
      message: result.message,
    }
  }

  const validated = VehicleListItemSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
