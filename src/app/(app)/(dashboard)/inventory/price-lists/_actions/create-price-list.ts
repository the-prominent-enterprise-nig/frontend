'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { PriceListFormSchema } from '@/src/schema/inventory/price-lists'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createPriceList(input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create price lists',
    }
  }

  const parsed = PriceListFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post('/inventory/price-lists', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create price list',
      message: msg || errStr || 'Failed to create price list',
    }
  }

  revalidatePath('/inventory/finance')

  return { success: true, data: result.data, message: 'Price list created successfully' }
}
