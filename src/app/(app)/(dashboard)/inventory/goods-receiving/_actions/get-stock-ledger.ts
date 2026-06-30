'use server'

import { api } from '@/src/libs/api/client'
import type { StockLedgerListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  branchId?: string
  transactionType?: string
  startDate?: string
  endDate?: string
}

export async function getStockLedger(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    branchId: params.branchId,
    transactionType: params.transactionType,
    startDate: params.startDate,
    endDate: params.endDate,
  }

  return api.get<StockLedgerListResponse>('/inventory/stock/ledger', query)
}
