'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { SupplierFormData, SupplierFormDataSchema } from '@/src/schema/procurement/suppliers/types'

export async function updateSupplier(
  id: string,
  data: Partial<SupplierFormData>
): Promise<ApiResponse> {
  try {
    const parsed = SupplierFormDataSchema.partial().parse(data)
    const result = await api.patch(`/suppliers/${id}`, parsed)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update supplier',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error updating supplier:', error)
    return {
      success: false,
      error: 'Failed to update supplier',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
