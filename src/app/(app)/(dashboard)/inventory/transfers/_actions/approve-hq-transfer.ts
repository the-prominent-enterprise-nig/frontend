'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function approveHqTransfer(id: string): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  const result = await api.patch(`/inventory/transfers/${id}/approve-hq`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to approve request',
      message: msg || errStr || 'Failed to approve request',
    }
  }

  revalidatePath('/inventory/transfers')

  return { success: true, message: 'Request approved — routed to the source branch' }
}
