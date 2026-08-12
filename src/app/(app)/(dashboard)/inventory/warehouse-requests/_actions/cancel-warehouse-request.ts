'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CancelWarehouseRequestFormValues } from '@/src/schema/inventory/warehouse-requests'

export async function cancelWarehouseRequest(
  id: string,
  data?: CancelWarehouseRequestFormValues
): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  const result = await api.patch(`/inventory/warehouse-requests/${id}/cancel`, data ?? {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to cancel warehouse request',
      message: msg || errStr || 'Failed to cancel warehouse request',
    }
  }

  revalidatePath('/inventory/warehouse-requests')

  return { success: true, message: 'Warehouse request cancelled' }
}
