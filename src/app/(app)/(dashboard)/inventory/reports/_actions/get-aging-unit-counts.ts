'use server'

import { api } from '@/src/libs/api/client'

type AgingUnitCounts = {
  summary: Record<string, { count: number }>
  totals: { count: number }
  asOf: string
}

/**
 * In-stock units per aging bucket, counts only — no cost. Readable with
 * inventory:stock:read, so roles "without item cost" (custodians, Inventory
 * Clerk) get the Inventory dashboard's aging card too.
 */
export async function getAgingUnitCounts(): ReturnType<typeof api.get<AgingUnitCounts>> {
  return api.get<AgingUnitCounts>('/inventory/reports/aging/units', undefined, {
    tags: ['inventory-report-aging'],
  })
}
