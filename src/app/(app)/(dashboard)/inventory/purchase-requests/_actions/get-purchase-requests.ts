'use server'

import { api } from '@/src/libs/api/client'
import type { PurchaseRequestListResponse } from '@/src/schema/inventory/purchase-requests'

type Params = {
  page?: number
  limit?: number
  status?: string
  branchId?: string
}

export async function getPurchaseRequests(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    status: params.status,
    branchId: params.branchId,
  }

  return api.get<PurchaseRequestListResponse>('/procurement/purchase-requests', query)
}
