'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export async function approvePurchaseOrder(id: string): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_APPROVE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to approve purchase orders',
    }
  }

  const result = await api.patch<{ id: string }>(`/procurement/purchase-orders/${id}/approve`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to approve purchase order',
      message: msg || errStr || 'Failed to approve purchase order',
    }
  }

  revalidatePath('/inventory/purchase-orders')

  return {
    success: true,
    data: result.data,
    message: 'Purchase order approved successfully',
  }
}
