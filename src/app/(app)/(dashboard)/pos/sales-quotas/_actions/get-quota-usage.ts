'use server'

import { api } from '@/src/libs/api/client'
import type { SalesQuotaUsage } from '@/src/schema/pos/sales-quotas'

export async function getSalesQuotaUsage(branchId?: string) {
  return api.get<SalesQuotaUsage>('/pos/sales-quotas/usage', branchId ? { branchId } : undefined)
}
