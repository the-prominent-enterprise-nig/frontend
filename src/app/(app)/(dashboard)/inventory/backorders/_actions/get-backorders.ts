'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { BackorderListResponse } from '@/src/schema/inventory/backorders'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  status?: string
}

export async function getBackorders(
  params: Params = {}
): Promise<ApiResponse<BackorderListResponse>> {
  try {
    const result = await api.get('/inventory/backorders', {
      itemId: params.itemId,
      status: params.status,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch backorders',
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

    if (raw && Array.isArray((raw as BackorderListResponse).data)) {
      return { success: true, data: raw as BackorderListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse backorders response',
    }
  } catch (error) {
    console.error('Error fetching backorders:', error)
    return {
      success: false,
      error: 'Failed to fetch backorders',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
