'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { PriceUseTypeFormSchema } from '@/src/schema/inventory/price-use-types'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function updatePriceUseType(
  id: string,
  input: unknown
): Promise<ApiResponse<unknown>> {
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

  const parsed = PriceUseTypeFormSchema.partial().safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/price-use-types/${id}`, parsed.data)
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to update price use type'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath('/inventory/price-use-types')
  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Price use type updated' }
}
