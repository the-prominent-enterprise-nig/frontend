'use server'

import { api } from '@/src/libs/api/client'
import { AgingReportResponseSchema } from '@/src/schema/inventory/reports'

type Params = {
  warehouseId?: string
  categoryId?: string
}

export async function getAgingReport(params: Params = {}) {
  const query: Record<string, string | undefined> = {
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
  }

  const result = await api.get('/inventory/reports/aging', query, {
    tags: ['inventory-report-aging'],
  })
  if (!result.success) return result

  const parsed = AgingReportResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    console.error('Aging report response shape mismatch:', parsed.error.flatten())
    return {
      success: false as const,
      error: 'Unexpected response shape',
      message: 'Failed to parse aging report response',
    }
  }

  return { success: true as const, data: parsed.data }
}
