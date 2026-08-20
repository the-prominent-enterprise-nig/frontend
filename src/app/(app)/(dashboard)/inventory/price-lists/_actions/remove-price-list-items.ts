'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/** Bulk counterpart to remove-price-list-item.ts's single-item DELETE —
 * backs the item-management page's checkbox-driven "Remove N items" action
 * (Scenario 34). The per-row single-item DELETE stays for the row's own
 * Remove button. */
export async function removePriceListItems(
  priceListId: string,
  itemIds: string[]
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

  const result = await api.delete(`/inventory/price-lists/${priceListId}/items`, {
    body: { itemIds },
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to remove items',
      message: msg || errStr || 'Failed to remove items',
    }
  }

  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Items removed' }
}
