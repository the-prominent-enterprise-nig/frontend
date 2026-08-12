'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function acceptWarehouseRequest(id: string): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  const result = await api.patch(`/inventory/warehouse-requests/${id}/accept`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to accept request',
      message: msg || errStr || 'Failed to accept request',
    }
  }

  revalidatePath('/inventory/warehouse-requests')

  return { success: true, message: 'Request accepted — ready to dispatch' }
}
