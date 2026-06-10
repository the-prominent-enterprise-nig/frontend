'use server'

import { api } from '@/src/libs/api/client'
import type { BatchListResponse } from '@/src/schema/inventory/batches'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  status?: string
  search?: string
}

export async function getBatches(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    status: params.status,
    search: params.search,
  }

  return api.get<BatchListResponse>('/inventory/batches', query)
}

export async function getExpiringBatches(
  params: { days?: number; page?: number; limit?: number } = {}
) {
  const query: Record<string, string | number | undefined> = {
    days: params.days ?? 30,
    page: params.page,
    limit: params.limit,
  }

  return api.get<BatchListResponse>('/inventory/batches/expiring-soon', query)
}
