'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { AddCountLineFormSchema, type CountLineSnapshot } from '@/src/schema/inventory/stock-counts'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function addCountLine(
  id: string,
  input: unknown
): Promise<ApiResponse<CountLineSnapshot>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to add lines to a stock count',
    }
  }

  const parsed = AddCountLineFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<CountLineSnapshot>(`/inventory/counts/${id}/lines`, parsed.data)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to add line',
      message: typeof result.message === 'string' ? result.message : 'Failed to add line',
    }
  }

  return { success: true, data: result.data, message: 'Line added' }
}
