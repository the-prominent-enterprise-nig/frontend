'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { DispatchTransferFormSchema } from '@/src/schema/inventory/transfers'

export async function dispatchTransfer(id: string, input?: unknown): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  const body = input ? DispatchTransferFormSchema.safeParse(input) : { success: true, data: {} }
  if (!body.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: (body as { success: false; error: { issues: { message: string }[] } }).error.issues
        .map((i) => i.message)
        .join(', '),
    }
  }

  const result = await api.patch(`/inventory/transfers/${id}/dispatch`, body.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to dispatch transfer',
      message: msg || errStr || 'Failed to dispatch transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  return { success: true, message: 'Transfer dispatched — stock deducted from source warehouse' }
}
