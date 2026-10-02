'use server'

import { api } from '@/src/libs/api/client'
import type { DailySalesMonitoringReport } from '@/src/schema/pos/daily-sales-monitoring'
import type { DailyCollectionParams } from './get-daily-collection'

/**
 * Scenario 61 — the client's Daily Sales Monitoring sheet. Same branch and
 * business date as the Daily Collection Report, and the same withholding: a
 * branch-assigned caller is forced to their own branch by the API.
 */
export async function getDailySalesMonitoring(params: DailyCollectionParams) {
  return api.get<DailySalesMonitoringReport>(
    '/pos/reports/daily-collection/sales-monitoring',
    { date: params.date, branchId: params.branchId },
    { tags: ['pos-report-daily-collection'] }
  )
}
