'use server'

import { api } from '@/src/libs/api/client'
import type { ProcurementQuota } from '@/src/schema/inventory/procurement-quotas'

export async function getProcurementQuotas() {
  return api.get<ProcurementQuota[]>('/procurement/quotas')
}
