'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  StockoutAlertListResponseSchema,
  type StockoutAlertListResponse,
} from '@/src/schema/inventory/projection'

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

    // Backend shape (ProjectionService.getStockoutAlerts): { alertWindowDays, alerts: [...] }
    const raw = result.data as { alerts?: unknown } | null
    const normalized = {
      data: raw?.alerts ?? [],
      total: Array.isArray(raw?.alerts) ? raw.alerts.length : 0,
    }

    const parsed = StockoutAlertListResponseSchema.safeParse(normalized)
    if (!parsed.success) {
      console.error('Stockout alerts response shape mismatch:', parsed.error.flatten())
      return {
        success: false,
        error: 'Unexpected response shape',
        message: 'Failed to parse stockout alerts response',
      }
    }

    return { success: true, data: parsed.data }
  } catch (error) {
    console.error('Error fetching stockout alerts:', error)
    return {
      success: false,
      error: 'Failed to fetch stockout alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
