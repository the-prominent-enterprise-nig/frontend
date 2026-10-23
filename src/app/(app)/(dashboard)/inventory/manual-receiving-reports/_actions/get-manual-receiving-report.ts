'use server'

import { api } from '@/src/libs/api/client'
import type { ManualReceivingReport } from '@/src/schema/inventory/manual-receiving-reports'

export async function getManualReceivingReport(id: string) {
  return api.get<ManualReceivingReport>(`/inventory/manual-receiving-reports/${id}`)
}
