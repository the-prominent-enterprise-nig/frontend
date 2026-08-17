'use server'

import { api } from '@/src/libs/api/client'
import type { ReconciliationReportResponse } from '@/src/schema/inventory/reports'

type Params = {
  startDate?: string
  endDate?: string
}

export async function getReconciliationReport(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    startDate: params.startDate,
    endDate: params.endDate,
  }

  return api.get<ReconciliationReportResponse>('/inventory/reports/reconciliation', query, {
    tags: ['inventory-report-reconciliation'],
  })
}
