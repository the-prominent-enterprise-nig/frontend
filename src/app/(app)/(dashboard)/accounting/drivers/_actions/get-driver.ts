'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { DriverSchema, type Driver } from '@/src/schema/inventory/drivers'

export async function getDriver(id: string): Promise<ApiResponse<Driver>> {
  const result = await api.get<Driver>(`/inventory/drivers/${id}`)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch driver',
      message: result.message,
    }
  }

  const validated = DriverSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data : result.data }
}
