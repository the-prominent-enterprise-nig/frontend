'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export async function cancelPurchaseRequest(id: string): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_CANCEL)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to cancel purchase requests',
    }
  }

  const result = await api.post<{ id: string }>(`/procurement/purchase-requests/${id}/cancel`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to cancel purchase request',
      message: msg || errStr || 'Failed to cancel purchase request',
    }
  }

  revalidatePath('/inventory/purchase-requests')

  return {
    success: true,
    data: result.data,
    message: 'Purchase request cancelled',
  }
}
