'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { ReservationListResponse } from '@/src/schema/inventory/reservations'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  status?: string
}

export async function getReservations(
  params: Params = {}
): Promise<ApiResponse<ReservationListResponse>> {
  try {
    const result = await api.get('/inventory/reservations', {
      status: params.status,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch reservations',
        message: result.message,
      }
    }

    const raw = result.data

    // API returns a plain array — normalize to paginated shape
    if (Array.isArray(raw)) {
      const page = params.page ?? 1
      const limit = params.limit ?? (raw.length || 20)
      const start = (page - 1) * limit
      const sliced = raw.slice(start, start + limit)
      return {
        success: true,
        data: { data: sliced, total: raw.length, page, limit },
      }
    }

    // API already returns paginated shape { data: [], total, page, limit }
    if (raw && Array.isArray(raw.data)) {
      return { success: true, data: raw as ReservationListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse reservations response',
    }
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return {
      success: false,
      error: 'Failed to fetch reservations',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
