'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function deleteVariant(
  itemId: string,
  variantId: string
): Promise<ApiResponse<unknown>> {
  if (!itemId || !variantId) {
    return { success: false, error: 'ID required', message: 'Item ID and variant ID are required' }
  }

  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.VARIANTS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage variants',
    }
  }

  const result = await api.delete(`/inventory/items/${itemId}/variants/${variantId}`)
  if (!result.success) {
    return {
      success: false,
      error: typeof result.error === 'string' ? result.error : 'Failed to delete variant',
      message: typeof result.message === 'string' ? result.message : 'Failed to delete variant',
    }
  }

  revalidatePath('/inventory/items')
  return { success: true, data: result.data, message: 'Variant deleted successfully' }
}
