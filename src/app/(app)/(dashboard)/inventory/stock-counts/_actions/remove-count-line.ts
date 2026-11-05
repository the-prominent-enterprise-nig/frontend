'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/** Scenario 87 — takes back a found unit added to the sheet by mistake. */
export async function removeCountLine(
  countId: string,
  lineId: string
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot change this count' }
  }
  const result = await api.delete<{ id: string }>(`/inventory/counts/${countId}/lines/${lineId}`)
  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to remove line',
      message: typeof result.message === 'string' ? result.message : 'Failed to remove line',
    }
  }
  return { success: true, data: result.data }
}
