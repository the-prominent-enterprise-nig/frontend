'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function resubmitPriceList(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to resubmit price lists',
    }
  }

  const result = await api.post(`/inventory/price-lists/${id}/resubmit`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to resubmit price list',
      message: msg || errStr || 'Failed to resubmit price list',
    }
  }

  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Price list resubmitted for approval' }
}
