'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type {
  DailyMonitoring,
  SalesByMonth,
  SalesFilterOptions,
  SalesLinesPage,
  SalesReportsParams,
  SalesSummary,
  Scorecard,
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

/** Scenario 85 Part 3 — units and gross per model or brand, month by month.
 * `top` omitted returns every row ("Show all"). */
export async function getSalesByMonth(
  params: SalesReportsParams & { dimension: 'model' | 'brand'; top?: number }
): Promise<ApiResponse<SalesByMonth>> {
  return api.get<SalesByMonth>('/pos/reports/sales/by-month', params, {
    tags: ['pos-sales-report-by-month'],
  })
}

/** Scenario 85 Part 5 — the To date's month, to date, per branch against quota. */
export async function getSalesScorecard(
  params: SalesReportsParams
): Promise<ApiResponse<Scorecard>> {
  return api.get<Scorecard>('/pos/reports/sales/scorecard', params, {
    tags: ['pos-sales-report-scorecard'],
  })
}

/** Scenario 85 Part 6 — each branch day by day for the To date's month. */
export async function getSalesDailyMonitoring(
  params: SalesReportsParams
): Promise<ApiResponse<DailyMonitoring>> {
  return api.get<DailyMonitoring>('/pos/reports/sales/daily-monitoring', params, {
    tags: ['pos-sales-report-daily-monitoring'],
  })
}
