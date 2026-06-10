'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { NegativeStockViolationListResponse } from '@/src/schema/inventory/negative-stock'

type Params = {
  page?: number
  limit?: number
}

export async function getNegativeStockViolations(
  params: Params = {}
): Promise<ApiResponse<NegativeStockViolationListResponse>> {
  try {
    const result = await api.get('/inventory/negative-stock/violations', {})

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch violations',
        message: result.message,
      }
    }

    const raw = result.data
    const page = params.page ?? 1
    const limit = params.limit ?? 100

    if (Array.isArray(raw)) {
      const start = (page - 1) * limit
      return {
        success: true,
        data: { data: raw.slice(start, start + limit), total: raw.length, page, limit },
      }
    }

    if (raw && Array.isArray((raw as NegativeStockViolationListResponse).data)) {
      return { success: true, data: raw as NegativeStockViolationListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse violations response',
    }
  } catch (error) {
    console.error('Error fetching negative stock violations:', error)
    return {
      success: false,
      error: 'Failed to fetch violations',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
