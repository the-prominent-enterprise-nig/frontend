'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { PaginatedSupplierSchema, type PaginatedSupplier } from '@/src/schema/inventory/suppliers'

/**
 * The directory's own list call. Not purchase-orders' getSuppliers, which
 * narrows the same endpoint down to id/code/name for a picker — this screen
 * paints each row's two statuses, its type and its terms, and filters on them.
 */
export async function listSuppliers(params?: {
  search?: string
  limit?: number
  page?: number
}): Promise<ApiResponse<PaginatedSupplier>> {
  try {
    const result = await api.get<unknown>('/suppliers', { ...params }, { tags: ['suppliers'] })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch suppliers',
        message: result.message,
      }
    }

    const parsed = PaginatedSupplierSchema.safeParse(result.data)
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid supplier list response',
        message: parsed.error.issues.map((i) => i.message).join(', '),
      }
    }

    return { success: true, data: parsed.data }
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return {
      success: false,
      error: 'Failed to fetch suppliers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
