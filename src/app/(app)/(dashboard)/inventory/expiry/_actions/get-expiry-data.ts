'use server'

import { api } from '@/src/libs/api/client'
import type { BatchListResponse } from '@/src/schema/inventory/batches'

export async function getExpiringBatches(
  params: { days?: number; page?: number; limit?: number } = {}
) {
  const query: Record<string, string | number | undefined> = {
    days: params.days,
    page: params.page,
    limit: params.limit,
  }

  return api.get<BatchListResponse>('/inventory/batches/expiring-soon', query)
}

export async function getAllBatchesWithExpiry(params: { page?: number; limit?: number } = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
  }

  return api.get<BatchListResponse>('/inventory/batches', query)
}
