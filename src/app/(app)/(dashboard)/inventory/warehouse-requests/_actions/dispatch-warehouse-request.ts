'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function dispatchWarehouseRequest(id: string): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  const result = await api.patch(`/inventory/warehouse-requests/${id}/dispatch`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to dispatch request',
      message: msg || errStr || 'Failed to dispatch request',
    }
  }

  revalidatePath('/inventory/warehouse-requests')

  return { success: true, message: 'Request dispatched' }
}
