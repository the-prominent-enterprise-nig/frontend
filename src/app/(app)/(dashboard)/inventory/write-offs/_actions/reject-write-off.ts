'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function rejectWriteOff(id: string, reason: string): Promise<ApiResponse<void>> {
  if (!id) return { success: false, error: 'Invalid ID', message: 'ID is required' }
  if (!reason?.trim()) {
    return { success: false, error: 'Reason is required', message: 'Rejection reason is required' }
  }

  const result = await api.post(`/inventory/adjustments/${id}/reject`, { reason })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to reject write-off',
      message: msg || errStr || 'Failed to reject write-off',
    }
  }

  revalidatePath('/inventory/write-offs')

  return { success: true, message: 'Write-off rejected' }
}
