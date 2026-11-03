'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { DriverListResponseSchema, type DriverListResponse } from '@/src/schema/inventory/drivers'

type Params = {
  q?: string
  branchId?: string
  page?: number
  limit?: number
}

export async function getDrivers(params: Params = {}): Promise<ApiResponse<DriverListResponse>> {
  const result = await api.get<DriverListResponse>(
    '/inventory/drivers',
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
