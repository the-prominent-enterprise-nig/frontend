'use server'

import { api } from '@/src/libs/api/client'
import type { PurchaseOrderListResponse } from '@/src/schema/inventory/purchase-orders'

type Params = {
  page?: number
  limit?: number
  status?: string
  supplierId?: string
  branchId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export async function getPurchaseOrders(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    status: params.status,
    supplierId: params.supplierId,
    branchId: params.branchId,
    search: params.search,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  }

  return api.get<PurchaseOrderListResponse>('/procurement/purchase-orders', query)
}
