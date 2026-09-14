'use server'

import { api } from '@/src/libs/api/client'

export type ReceivingReportsSummary = {
  receiptsLast30Days: number
  unitsReceivedTotal: number
  linesReceivedTotal: number
  shortDeliveries: number
}

// Tenant-wide KPIs for the Receiving Reports header — independent of
// whatever filters the table below has active, same as the Serial Number
// Tracking stat row.
export async function getReceivingReportsSummary() {
  return api.get<ReceivingReportsSummary>('/inventory/stock/receiving-reports/summary')
}
