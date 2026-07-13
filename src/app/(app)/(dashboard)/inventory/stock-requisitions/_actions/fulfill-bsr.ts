'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function fulfillBsr(id: string): Promise<ApiResponse<void>> {
  if (!id) return { success: false, error: 'Invalid ID', message: 'ID is required' }

  const result = await api.post(`/inventory/stock-requisitions/${id}/fulfill`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to fulfill requisition',
      message: msg || errStr || 'Failed to fulfill requisition',
    }
  }

  revalidatePath('/inventory/stock-requisitions')

  return { success: true, message: 'Requisition fulfilled' }
}
