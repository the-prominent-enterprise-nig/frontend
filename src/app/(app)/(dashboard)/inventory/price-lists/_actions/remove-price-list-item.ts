'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function removePriceListItem(
  priceListId: string,
  itemId: string
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to edit price list items',
    }
  }

  const result = await api.delete(`/inventory/price-lists/${priceListId}/items/${itemId}`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to remove item',
      message: msg || errStr || 'Failed to remove item',
    }
  }

  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Item removed' }
}
