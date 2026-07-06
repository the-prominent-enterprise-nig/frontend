'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getBsrs(params?: {
  page?: number
  limit?: number
  status?: string
  branchId?: string
}): Promise<ApiResponse<unknown>> {
  return api.get(
    '/inventory/stock-requisitions',
    params as Record<string, string | number | boolean | undefined>
  )
}
