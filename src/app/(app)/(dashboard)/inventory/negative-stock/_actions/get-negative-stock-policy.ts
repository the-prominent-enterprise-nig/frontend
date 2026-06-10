'use server'

import { api } from '@/src/libs/api/client'
import type { NegativeStockPolicyData } from '@/src/schema/inventory/negative-stock'

export async function getNegativeStockPolicy() {
  return api.get<NegativeStockPolicyData>('/inventory/negative-stock/policy')
}
