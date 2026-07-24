'use server'

import { api } from '@/src/libs/api/client'
import type { SerialNumberListResponse } from '@/src/schema/inventory/serial-numbers'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  status?: string
  search?: string
  // Scenario 08 (Caravan) Part 2 — "Caravan @ Host" view. Any value here
  // signals "show what's consigned to my branch" — the backend always
  // resolves the real branch server-side for a branch-restricted caller, so
  // the value itself only matters for an unrestricted Business Owner
  // explicitly checking a specific branch.
  consignedToBranchId?: string
}

export async function getSerialNumbers(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    status: params.status,
    search: params.search,
    consignedToBranchId: params.consignedToBranchId,
  }

  return api.get<SerialNumberListResponse>('/inventory/serial-numbers', query)
}
