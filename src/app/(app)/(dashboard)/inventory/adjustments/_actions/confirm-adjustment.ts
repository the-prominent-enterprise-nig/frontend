'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function confirmAdjustment(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to confirm stock adjustments',
    }
  }

  const result = await api.patch(`/inventory/adjustments/${id}/confirm`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to confirm adjustment',
      message: typeof result.message === 'string' ? result.message : 'Failed to confirm adjustment',
    }
  }

  revalidatePath('/inventory/operations')

  return { success: true, data: result.data, message: 'Adjustment confirmed' }
}
