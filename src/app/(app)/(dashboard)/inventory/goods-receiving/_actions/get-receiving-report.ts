'use server'

import { api } from '@/src/libs/api/client'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

export async function getReceivingReport(id: string) {
  return api.get<ReceivingReport>(`/inventory/stock/receiving-reports/${id}`)
}
