'use server'

import { api } from '@/src/libs/api/client'
import type { DailyCollectionRollup } from '@/src/schema/pos/daily-collection'

/**
 * Every branch's day on one row — the owner's way into the per-branch report.
 *
 * A branch-assigned caller gets their own branch only, which the API decides;
 * nothing here has to know whether the session is scoped.
 */
export async function getDailyCollectionRollup(params: { date: string }) {
  return api.get<DailyCollectionRollup>(
    '/pos/reports/daily-collection/branches',
    { date: params.date },
    { tags: ['pos-report-daily-collection'] }
  )
}
