'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { SubmitCountFormSchema } from '@/src/schema/inventory/stock-counts'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function submitCount(id: string, input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to submit stock counts',
    }
  }

  const parsed = SubmitCountFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post(`/inventory/counts/${id}/submit`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to submit count',
      message: msg || errStr || 'Failed to submit count',
    }
  }

  revalidatePath('/inventory/stock-counts')

  return { success: true, data: result.data, message: 'Count submitted and variances reconciled' }
}
