'use server'

import { api } from '@/src/libs/api/client'
import type { WithholdingSummaryResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  supplierId?: string
  startDate?: string
  endDate?: string
}

export async function getWithholdingSummary(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    supplierId: params.supplierId,
    startDate: params.startDate,
    endDate: params.endDate,
  }

  return api.get<WithholdingSummaryResponse>('/inventory/stock/withholding-summary', query)
}
