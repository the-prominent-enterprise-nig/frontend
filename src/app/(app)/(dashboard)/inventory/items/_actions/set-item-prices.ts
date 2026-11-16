'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  PriceListImportResultSchema,
  type PriceListImportResult,
} from '@/src/schema/inventory/price-lists/import'
import type { ItemPricePayload } from '@/src/schema/inventory/items/item-prices'
import { humanizePriceListError } from '@/src/app/(app)/(dashboard)/pos/price-lists/_lib/humanize-error'

/** Puts one item on the price list for each price use — the Add Item form's
 * price section. Same routing and rules as the price list upload. */
export async function setItemPrices(
  itemId: string,
  prices: ItemPricePayload[]
): Promise<ApiResponse<PriceListImportResult>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot edit price lists' }
  }

  const result = await api.post<unknown>(`/inventory/items/${itemId}/prices`, { prices })
  if (!result.success) {
    const raw = typeof result.message === 'string' ? result.message : undefined
    return {
      success: false,
      error: 'set_prices_failed',
      message: humanizePriceListError(raw) ?? raw ?? 'Could not save the prices',
    }
  }
  const parsed = PriceListImportResultSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'invalid_response', message: 'Unexpected response from server' }
  }
  revalidatePath('/pos/price-lists')
  return { success: true, data: parsed.data, message: 'Prices saved' }
}
