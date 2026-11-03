'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { SupplierDetailSchema, type SupplierDetail } from '@/src/schema/inventory/suppliers'

export async function getSupplier(id: string): Promise<ApiResponse<SupplierDetail>> {
  try {
    const result = await api.get<unknown>(`/suppliers/${id}`, undefined, {
      tags: ['suppliers', `supplier-${id}`],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch supplier',
        message: result.message,
      }
    }

    const parsed = SupplierDetailSchema.safeParse(result.data)
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid supplier response',
        message: parsed.error.issues.map((i) => i.message).join(', '),
      }
    }

    return { success: true, data: parsed.data }
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return {
      success: false,
      error: 'Failed to fetch supplier',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
