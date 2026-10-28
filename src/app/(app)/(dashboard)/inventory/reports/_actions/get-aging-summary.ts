'use server'

import { api } from '@/src/libs/api/client'
import type { AgingReportResponse } from '@/src/schema/inventory/reports'

/**
 * Just the aging report's bucket cards and totals (`view=summary`), without the
 * unit rows — what the Inventory dashboard shows. The full report loads every
 * in-stock unit with its joins to hand back one page; this reads only the
 * columns the buckets need.
 */
export async function getAgingSummary() {
  return api.get<Pick<AgingReportResponse, 'summary' | 'totals' | 'asOf'>>(
    '/inventory/reports/aging',
    { view: 'summary' },
    { tags: ['inventory-report-aging'] }
  )
}
