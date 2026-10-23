'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { DriverListItemSchema, type DriverListItem } from '@/src/schema/inventory/vehicles'

export async function getDriver(id: string): Promise<ApiResponse<DriverListItem>> {
  const result = await api.get<DriverListItem>(`/inventory/vehicles/drivers/${id}`)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch driver',
      message: result.message,
    }
  }

  const validated = DriverListItemSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
