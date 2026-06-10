'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { ProjectionListResponse } from '@/src/schema/inventory/projection'

type Params = {
  itemId?: string
  warehouseId?: string
  categoryId?: string
  days?: number
}

export async function getProjection(
  params: Params = {}
): Promise<ApiResponse<ProjectionListResponse>> {
  try {
    const result = await api.get('/inventory/projection', {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      categoryId: params.categoryId,
      days: params.days,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch projection',
        message: result.message,
      }
    }

    const raw = result.data

    if (Array.isArray(raw)) {
      return { success: true, data: { data: raw, total: raw.length } }
    }

    if (raw && Array.isArray((raw as ProjectionListResponse).data)) {
      return { success: true, data: raw as ProjectionListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse projection response',
    }
  } catch (error) {
    console.error('Error fetching projection:', error)
    return {
      success: false,
      error: 'Failed to fetch projection',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
