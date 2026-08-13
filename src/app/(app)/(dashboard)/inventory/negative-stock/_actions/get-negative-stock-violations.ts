'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  NegativeStockViolationListResponseSchema,
  type NegativeStockViolationListResponse,
} from '@/src/schema/inventory/negative-stock'

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

    const normalized = Array.isArray(raw)
      ? {
          data: raw.slice((page - 1) * limit, (page - 1) * limit + limit),
          total: raw.length,
          page,
          limit,
        }
      : raw

    const parsed = NegativeStockViolationListResponseSchema.safeParse(normalized)
    if (!parsed.success) {
      console.error('Negative stock violations response shape mismatch:', parsed.error.flatten())
      return {
        success: false,
        error: 'Unexpected response shape',
        message: 'Failed to parse violations response',
      }
    }

    return { success: true, data: parsed.data }
  } catch (error) {
    console.error('Error fetching negative stock violations:', error)
    return {
      success: false,
      error: 'Failed to fetch violations',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
