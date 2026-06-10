'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { Supplier, SupplierSchema } from '@/src/schema/procurement/suppliers/types'

export async function getSupplierById(id: string): Promise<ApiResponse<Supplier>> {
  try {
    const result = await api.get<Supplier>(`/suppliers/${id}`, undefined, {
      tags: ['suppliers', `supplier-${id}`],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch supplier',
        message: result.message,
      }
    }

    const validated = SupplierSchema.parse(result.data)
    return { success: true, data: validated }
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return {
      success: false,
      error: 'Failed to fetch supplier',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
