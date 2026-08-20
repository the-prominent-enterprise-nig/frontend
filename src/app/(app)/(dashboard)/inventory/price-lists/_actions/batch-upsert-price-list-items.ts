'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpsertPriceListItemFormSchema } from '@/src/schema/inventory/price-lists'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/** Batch counterpart to upsert-price-list-items.ts's single-item action —
 * one network call with an array body, backing the item-management page's
 * multi-select "Add N Items" flow (Scenario 34). */
export async function batchUpsertPriceListItems(
  priceListId: string,
  items: unknown[]
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

  const parsed = items.map((item) => UpsertPriceListItemFormSchema.safeParse(item))
  const firstFailure = parsed.find((p) => !p.success)
  if (firstFailure && !firstFailure.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: firstFailure.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post(`/inventory/price-lists/${priceListId}/items`, {
    items: parsed.map((p) => (p.success ? p.data : undefined)),
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to add items',
      message: msg || errStr || 'Failed to add items',
    }
  }

  revalidatePath('/inventory/price-lists')

  return { success: true, data: result.data, message: 'Items added' }
}
