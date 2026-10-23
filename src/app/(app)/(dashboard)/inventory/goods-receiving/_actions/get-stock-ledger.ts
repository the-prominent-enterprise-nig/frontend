'use server'

import { api } from '@/src/libs/api/client'
import type { StockLedgerListResponse } from '@/src/schema/inventory/goods-receiving'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  branchId?: string
  // Scenario 56 — Operations + multi-select Branches.
  branchIds?: string[]
  warehouseIds?: string[]
  region?: 'panay' | 'negros'
  transactionType?: string
  startDate?: string
  endDate?: string
  /** Serial number, receiving report code, or invoice number. */
  search?: string
}

export async function getStockLedger(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    branchId: params.branchId,
    branchIds: params.branchIds?.length ? params.branchIds.join(',') : undefined,
    warehouseIds: params.warehouseIds?.length ? params.warehouseIds.join(',') : undefined,
    region: params.region,
    transactionType: params.transactionType,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
  }

  return api.get<StockLedgerListResponse>('/inventory/stock/ledger', query)
}
