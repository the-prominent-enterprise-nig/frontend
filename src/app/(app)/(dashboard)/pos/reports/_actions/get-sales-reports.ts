'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type {
  SalesFilterOptions,
  SalesLinesPage,
  SalesReportsParams,
  SalesSummary,
} from '@/src/schema/pos/sales-reports'

/** Scenario 85 — options for the shared filter bar. Served by the reports
 * module itself, so a Branch Manager needs no inventory/settings access. */
export async function getSalesFilterOptions(): Promise<ApiResponse<SalesFilterOptions>> {
  return api.get<SalesFilterOptions>('/pos/reports/sales/filters', undefined, {
    tags: ['pos-sales-report-filters'],
  })
}

/** Scenario 85 — Total / Office / Agent sales and units for the filters. */
export async function getSalesSummary(
  params: SalesReportsParams
): Promise<ApiResponse<SalesSummary>> {
  return api.get<SalesSummary>('/pos/reports/sales/summary', params, {
    tags: ['pos-sales-report-summary'],
  })
}

/** Scenario 85 Part 2 — one page of the Sales Report tab's sold units. */
export async function getSalesLines(
  params: SalesReportsParams & { page: number; limit: number }
): Promise<ApiResponse<SalesLinesPage>> {
  return api.get<SalesLinesPage>('/pos/reports/sales/lines', params, {
    tags: ['pos-sales-report-lines'],
  })
}
