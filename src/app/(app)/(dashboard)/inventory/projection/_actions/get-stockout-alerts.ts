'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { StockoutAlertListResponse } from '@/src/schema/inventory/projection'

type Params = {
  days?: number
  warehouseId?: string
}

export async function getStockoutAlerts(
  params: Params = {}
): Promise<ApiResponse<StockoutAlertListResponse>> {
  try {
    const result = await api.get('/inventory/projection/stockout-alerts', {
      days: params.days,
      warehouseId: params.warehouseId,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch stockout alerts',
        message: result.message,
      }
    }

    const raw = result.data

    if (Array.isArray(raw)) {
      return { success: true, data: { data: raw, total: raw.length } }
    }

    if (raw && Array.isArray((raw as StockoutAlertListResponse).data)) {
      return { success: true, data: raw as StockoutAlertListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse stockout alerts response',
    }
  } catch (error) {
    console.error('Error fetching stockout alerts:', error)
    return {
      success: false,
      error: 'Failed to fetch stockout alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
