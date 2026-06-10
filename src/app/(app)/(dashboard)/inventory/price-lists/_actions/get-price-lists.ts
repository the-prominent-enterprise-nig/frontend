'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PriceListListResponse } from '@/src/schema/inventory/price-lists'

type Params = {
  page?: number
  limit?: number
  search?: string
  status?: string
}

export async function getPriceLists(
  params: Params = {}
): Promise<ApiResponse<PriceListListResponse>> {
  try {
    const result = await api.get('/inventory/price-lists', {
      search: params.search,
      status: params.status,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch price lists',
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

    if (raw && Array.isArray((raw as PriceListListResponse).data)) {
      return { success: true, data: raw as PriceListListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse price lists response',
    }
  } catch (error) {
    console.error('Error fetching price lists:', error)
    return {
      success: false,
      error: 'Failed to fetch price lists',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
