'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function cancelCount(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to cancel stock counts',
    }
  }

  const result = await api.patch(`/inventory/counts/${id}/cancel`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to cancel count',
      message: typeof result.message === 'string' ? result.message : 'Failed to cancel count',
    }
  }

  revalidatePath('/inventory/stock-counts')

  return { success: true, data: result.data, message: 'Count session cancelled' }
}
