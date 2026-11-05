'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdateCountLineSchema, type CountLineSnapshot } from '@/src/schema/inventory/stock-counts'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/** Scenario 87 — saves one Count Sheet line's tick and Remarks as the
 * counter goes, so the sheet survives a refresh and can be resumed. */
export async function updateCountLine(
  countId: string,
  lineId: string,
  input: unknown
): Promise<ApiResponse<CountLineSnapshot>> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot change this count' }
  }
  const parsed = UpdateCountLineSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }
  const result = await api.patch<CountLineSnapshot>(
    `/inventory/counts/${countId}/lines/${lineId}`,
    parsed.data
  )
  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to save line',
      message: typeof result.message === 'string' ? result.message : 'Failed to save line',
    }
  }
  return { success: true, data: result.data }
}
