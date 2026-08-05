'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { RejectAdjustmentFormSchema } from '@/src/schema/inventory/adjustments'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function rejectAdjustment(id: string, input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to reject stock adjustments',
    }
  }

  const parsed = RejectAdjustmentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post(`/inventory/adjustments/${id}/reject`, parsed.data)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to reject adjustment',
      message: typeof result.message === 'string' ? result.message : 'Failed to reject adjustment',
    }
  }

  revalidatePath('/inventory/adjustment-approvals')

  return { success: true, data: result.data, message: 'Adjustment rejected' }
}
