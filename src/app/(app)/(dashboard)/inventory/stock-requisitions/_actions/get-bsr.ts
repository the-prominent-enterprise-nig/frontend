'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getBsr(id: string): Promise<ApiResponse<unknown>> {
  return api.get(`/inventory/stock-requisitions/${id}`)
}
