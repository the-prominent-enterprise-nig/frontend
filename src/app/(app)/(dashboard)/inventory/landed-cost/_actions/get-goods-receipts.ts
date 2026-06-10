'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { GoodsReceiptRefListResponse } from '@/src/schema/inventory/landed-cost'

type Params = {
  page?: number
  limit?: number
}

export async function getGoodsReceipts(
  params: Params = {}
): Promise<ApiResponse<GoodsReceiptRefListResponse>> {
  try {
    const result = await api.get('/inventory/receive', {})

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch goods receipts',
        message: result.message,
      }
    }

    const raw = result.data
    const page = params.page ?? 1
    const limit = params.limit ?? 200

    if (Array.isArray(raw)) {
      const start = (page - 1) * limit
      return {
        success: true,
        data: { data: raw.slice(start, start + limit), total: raw.length, page, limit },
      }
    }

    if (raw && Array.isArray((raw as GoodsReceiptRefListResponse).data)) {
      return { success: true, data: raw as GoodsReceiptRefListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse goods receipts response',
    }
  } catch (error) {
    console.error('Error fetching goods receipts:', error)
    return {
      success: false,
      error: 'Failed to fetch goods receipts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
