'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  ReorderAlertListResponseSchema,
  type ReorderAlertListResponse,
} from '@/src/schema/inventory/reorder'

export async function getReorderAlerts(
  params: { page?: number; limit?: number } = {}
): Promise<ApiResponse<ReorderAlertListResponse>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
  }

  const result = await api.get('/inventory/stock/reorder-alerts', query)
  if (!result.success) return result

  const parsed = ReorderAlertListResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    console.error('Reorder alerts response shape mismatch:', parsed.error.flatten())
    return {
      success: false as const,
      error: 'Unexpected response shape',
      message: 'Failed to parse reorder alerts response',
    }
  }

  return { success: true as const, data: parsed.data }
}
