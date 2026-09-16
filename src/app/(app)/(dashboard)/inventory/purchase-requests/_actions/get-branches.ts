'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getBranches(): Promise<
  // Scenario 50 Gap 6 — `type` widened onto the return shape (the backend
  // already sends it on every row via BRANCH_SELECT; this file just never
  // typed it). Additive only — every existing caller keeps working, since
  // nothing here changes what the endpoint returns or filters.
  ApiResponse<{
    data: { id: string; name: string; type?: 'retail' | 'warehouse' | 'office' | 'mixed' }[]
    total: number
  }>
> {
  return api.get('/branches', { limit: 200 }) as Promise<
    ApiResponse<{
      data: { id: string; name: string; type?: 'retail' | 'warehouse' | 'office' | 'mixed' }[]
      total: number
    }>
  >
}
