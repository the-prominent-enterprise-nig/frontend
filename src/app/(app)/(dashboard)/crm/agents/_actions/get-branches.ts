'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getBranches(): Promise<
  ApiResponse<{ data: { id: string; name: string }[]; total: number }>
> {
  return api.get('/branches', { limit: 200 }) as Promise<
    ApiResponse<{ data: { id: string; name: string }[]; total: number }>
  >
}
