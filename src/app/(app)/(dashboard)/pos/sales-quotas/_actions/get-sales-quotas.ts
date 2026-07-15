'use server'

import { api } from '@/src/libs/api/client'
import type { SalesQuota } from '@/src/schema/pos/sales-quotas'

export async function getSalesQuotas() {
  return api.get<SalesQuota[]>('/pos/sales-quotas')
}
