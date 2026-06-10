'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateAdjustmentFormSchema } from '@/src/schema/inventory/stock-counts'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createAdjustment(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_COUNT_ADJUST)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to post stock adjustments',
    }
  }

  const parsed = CreateAdjustmentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/adjustments', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create adjustment',
      message: msg || errStr || 'Failed to create adjustment',
    }
  }

  revalidatePath('/inventory/stock-counts')

  return { success: true, data: result.data, message: 'Adjustment recorded successfully' }
}
