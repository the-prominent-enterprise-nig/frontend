'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export type ReceiveWarehouseRequestLine = {
  warehouseRequestLineId: string
  quantityReceived: number
}

export async function receiveWarehouseRequest(
  id: string,
  lines: ReceiveWarehouseRequestLine[]
): Promise<ApiResponse<{ status: string }>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  const result = await api.patch<{ status: string }>(
    `/inventory/warehouse-requests/${id}/receive`,
    {
      lines,
    }
  )

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to receive warehouse request',
      message: msg || errStr || 'Failed to receive warehouse request',
    }
  }

  revalidatePath('/inventory/warehouse-requests')

  return { success: true, message: 'Warehouse request received — stock credited to your branch' }
}
