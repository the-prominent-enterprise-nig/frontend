'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { LandedCostListResponse } from '@/src/schema/inventory/landed-cost'

type Params = {
  page?: number
  limit?: number
}

export async function getLandedCosts(
  params: Params = {}
): Promise<ApiResponse<LandedCostListResponse>> {
  try {
    const result = await api.get('/inventory/landed-costs', {})

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch landed costs',
        message: result.message,
      }
    }

    const raw = result.data
    const page = params.page ?? 1
    const limit = params.limit ?? 20

    if (Array.isArray(raw)) {
      const start = (page - 1) * limit
      return {
        success: true,
        data: { data: raw.slice(start, start + limit), total: raw.length, page, limit },
      }
    }

    if (raw && Array.isArray((raw as LandedCostListResponse).data)) {
      return { success: true, data: raw as LandedCostListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse landed costs response',
    }
  } catch (error) {
    console.error('Error fetching landed costs:', error)
    return {
      success: false,
      error: 'Failed to fetch landed costs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
