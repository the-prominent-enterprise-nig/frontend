'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { SupplierFormData, SupplierFormDataSchema } from '@/src/schema/procurement/suppliers/types'

export async function createSupplier(data: SupplierFormData): Promise<ApiResponse> {
  try {
    const parsed = SupplierFormDataSchema.parse(data)
    const result = await api.post('/suppliers', parsed)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create supplier',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error creating supplier:', error)
    return {
      success: false,
      error: 'Failed to create supplier',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
