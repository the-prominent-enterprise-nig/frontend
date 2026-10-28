'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { DriverListResponseSchema, type Driver } from '@/src/schema/inventory/drivers'

type Params = {
  q?: string
  branchId?: string
}

// The dispatch form's Driver Name suggestions: the drivers on file for the
// branch the stock leaves from. A short list — it is a type-ahead, not a page.
export async function searchDrivers(params: Params = {}): Promise<ApiResponse<Driver[]>> {
  const result = await api.get<{ data: Driver[] }>('/inventory/drivers', {
    q: params.q,
    branchId: params.branchId,
    limit: 20,
  })

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch drivers',
      message: result.message,
    }
  }

  const validated = DriverListResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data.data : result.data.data }
}
