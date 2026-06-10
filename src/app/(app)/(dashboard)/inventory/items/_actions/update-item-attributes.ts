'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function updateItemAttributes(
  itemId: string,
  attributes: Record<string, string>
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update item attributes',
    }
  }

  const result = await api.patch(`/inventory/attributes/items/${itemId}`, { attributes })

  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update attributes',
      message: msg || errStr,
    }
  }

  return { success: true, message: 'Attributes updated' }
}
