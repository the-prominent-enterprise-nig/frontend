'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function deletePriceUseType(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_MANAGE_PRICE_USE_TYPES)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage price use types',
    }
  }

  const result = await api.delete(`/inventory/price-use-types/${id}`)
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to delete price use type'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath('/inventory/price-use-types')
  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Price use type deleted' }
}
