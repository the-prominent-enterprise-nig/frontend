'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/**
 * "Delete" from the user's point of view — under the hood this is the
 * backend's DELETE /price-lists/:id, which soft-deletes by flipping status
 * to 'inactive' rather than removing the row (price lists keep an audit
 * trail; there's no hard-delete). A New Version can still be created from an
 * inactive list later if the pricing needs to come back.
 */
export async function deletePriceList(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_DELETE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to delete price lists',
    }
  }

  const result = await api.delete(`/inventory/price-lists/${id}`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to delete price list',
      message: msg || errStr || 'Failed to delete price list',
    }
  }

  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Price list deleted' }
}
