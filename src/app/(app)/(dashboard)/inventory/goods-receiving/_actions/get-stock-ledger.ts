'use server'

import { api } from '@/src/libs/api/client'
import type { StockLedgerListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  movementType?: string
}

export async function getStockLedger(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    movementType: params.movementType,
  }

  return api.get<StockLedgerListResponse>('/inventory/stock/ledger', query)
}
