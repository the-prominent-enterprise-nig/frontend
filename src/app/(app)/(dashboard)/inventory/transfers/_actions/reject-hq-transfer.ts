'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { RejectHqTransferFormSchema } from '@/src/schema/inventory/transfers'

export async function rejectHqTransfer(id: string, input: unknown): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  const parsed = RejectHqTransferFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/transfers/${id}/reject-hq`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to reject request',
      message: msg || errStr || 'Failed to reject request',
    }
  }

  revalidatePath('/inventory/transfers')

  return { success: true, message: 'Request rejected' }
}
