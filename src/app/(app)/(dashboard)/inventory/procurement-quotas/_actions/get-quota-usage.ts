'use server'

import { api } from '@/src/libs/api/client'
import type { QuotaUsage } from '@/src/schema/inventory/procurement-quotas'

export async function getQuotaUsage(branchId?: string) {
  return api.get<QuotaUsage>('/procurement/quotas/usage', branchId ? { branchId } : undefined)
}
