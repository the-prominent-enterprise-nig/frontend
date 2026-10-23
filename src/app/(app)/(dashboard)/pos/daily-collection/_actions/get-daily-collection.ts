'use server'

import { api } from '@/src/libs/api/client'
import type { DailyCollectionReport } from '@/src/schema/pos/daily-collection'

export type DailyCollectionParams = {
  date: string
  branchId?: string
}

/**
 * Scenario 53 Part 6 — one branch, one business date. Deliberately narrower
 * than the date-ranged sales reports: the client's own form carries a single
 * branch name and a single date in its header.
 */
export async function getDailyCollection(params: DailyCollectionParams) {
  return api.get<DailyCollectionReport>(
    '/pos/reports/daily-collection',
    { date: params.date, branchId: params.branchId },
    { tags: ['pos-report-daily-collection'] }
  )
}
