'use server'

import { api } from '@/src/libs/api/client'
import type { SalesReportResponse } from '@/src/schema/pos/reports'

export type SalesReportParams = {
  startDate?: string
  endDate?: string
  branchIds?: string[]
  brandIds?: string[]
  categoryIds?: string[]
  invoiceType?: 'cash' | 'charge' | 'installment'
}

/** Both sales reports share one query shape — only the endpoint differs. */
function toQuery(params: SalesReportParams): Record<string, string | undefined> {
  return {
    startDate: params.startDate,
    endDate: params.endDate,
    branchIds: params.branchIds?.length ? params.branchIds.join(',') : undefined,
    brandIds: params.brandIds?.length ? params.brandIds.join(',') : undefined,
    categoryIds: params.categoryIds?.length ? params.categoryIds.join(',') : undefined,
    invoiceType: params.invoiceType,
  }
}

export async function getSalesByBranch(params: SalesReportParams = {}) {
  return api.get<SalesReportResponse>('/pos/reports/sales-by-branch', toQuery(params), {
    tags: ['pos-report-sales-by-branch'],
  })
}

export async function getSalesByBrand(params: SalesReportParams = {}) {
  return api.get<SalesReportResponse>('/pos/reports/sales-by-brand', toQuery(params), {
    tags: ['pos-report-sales-by-brand'],
  })
}
