'use server'

import { api } from '@/src/libs/api/client'
import type { ReorderAlertListResponse } from '@/src/schema/inventory/reorder'

export async function getReorderAlerts(params: { page?: number; limit?: number } = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
  }

  return api.get<ReorderAlertListResponse>('/inventory/stock/reorder-alerts', query)
}
