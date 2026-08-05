'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function approveAdjustment(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to approve stock adjustments',
    }
  }

  const result = await api.patch(`/inventory/adjustments/${id}/approve`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to approve adjustment',
      message: typeof result.message === 'string' ? result.message : 'Failed to approve adjustment',
    }
  }

  revalidatePath('/inventory/counting')

  return { success: true, data: result.data, message: 'Adjustment approved and posted' }
}
