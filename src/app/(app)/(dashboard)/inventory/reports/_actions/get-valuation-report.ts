'use server'

import { api } from '@/src/libs/api/client'
import { ValuationReportResponseSchema } from '@/src/schema/inventory/reports'

type Params = {
  warehouseId?: string
  categoryId?: string
  search?: string
  page?: number
  limit?: number
}

export async function getValuationReport(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    search: params.search,
    page: params.page,
    limit: params.limit,
  }

  const result = await api.get('/inventory/reports/valuation', query, {
    tags: ['inventory-report-valuation'],
  })
  if (!result.success) return result

  const parsed = ValuationReportResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    console.error('Valuation report response shape mismatch:', parsed.error.flatten())
    return {
      success: false as const,
      error: 'Unexpected response shape',
      message: 'Failed to parse valuation report response',
    }
  }

  return { success: true as const, data: parsed.data }
}
