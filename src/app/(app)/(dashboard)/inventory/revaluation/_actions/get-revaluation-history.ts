'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { RevaluationListResponse } from '@/src/schema/inventory/revaluation'

type Params = {
  itemId?: string
  warehouseId?: string
}

export async function getRevaluationHistory(
  params: Params = {}
): Promise<ApiResponse<RevaluationListResponse>> {
  try {
    const result = await api.get('/inventory/costing/item-revaluations', {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch revaluation history',
        message: result.message,
      }
    }

    const raw = result.data

    if (Array.isArray(raw)) {
      return { success: true, data: { data: raw, total: raw.length } }
    }

    if (raw && Array.isArray((raw as RevaluationListResponse).data)) {
      return { success: true, data: raw as RevaluationListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse revaluation history response',
    }
  } catch (error) {
    console.error('Error fetching revaluation history:', error)
    return {
      success: false,
      error: 'Failed to fetch revaluation history',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
