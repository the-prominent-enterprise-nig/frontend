'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export type BranchLookup = {
  id: string
  name: string
  region?: 'panay' | 'negros' | null
  type?: string
}

export async function getBranches(): Promise<
  ApiResponse<{ data: BranchLookup[]; meta: { total: number } }>
> {
  return api.get('/branches') as Promise<
    ApiResponse<{ data: BranchLookup[]; meta: { total: number } }>
  >
}
