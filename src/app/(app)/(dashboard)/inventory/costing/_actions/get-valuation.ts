'use server'

import { api } from '@/src/libs/api/client'
import type { ValuationResponse } from '@/src/schema/inventory/costing'

export async function getValuation(params?: { warehouseId?: string }) {
  return api.get<ValuationResponse>('/inventory/costing/valuation', params, {
    tags: ['inventory-costing-valuation'],
  })
}
