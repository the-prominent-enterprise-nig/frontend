'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function deleteSupplier(id: string): Promise<ApiResponse> {
  try {
    const result = await api.delete(`/suppliers/${id}`)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete supplier',
        message: result.message,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return {
      success: false,
      error: 'Failed to delete supplier',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
