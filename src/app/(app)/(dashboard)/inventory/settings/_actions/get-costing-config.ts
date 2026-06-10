'use server'

import { api } from '@/src/libs/api/client'
import type { CostingConfig } from '@/src/schema/inventory/costing'

export async function getCostingConfig() {
  return api.get<CostingConfig>('/inventory/costing/config', undefined, {
    tags: ['inventory-costing-config'],
  })
}
