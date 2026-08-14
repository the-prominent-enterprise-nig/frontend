'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { RejectWarehouseRequestFormSchema } from '@/src/schema/inventory/warehouse-requests'

export async function rejectWarehouseRequest(
  id: string,
  input: unknown
): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid request ID', message: 'Request ID is required' }
  }

  const parsed = RejectWarehouseRequestFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/warehouse-requests/${id}/reject`, parsed.data)

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

  revalidatePath('/inventory/warehouse-requests')

  return { success: true, message: 'Request rejected' }
}
