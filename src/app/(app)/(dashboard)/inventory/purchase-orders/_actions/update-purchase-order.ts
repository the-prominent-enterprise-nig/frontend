'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdatePoServerSchema } from '@/src/schema/inventory/purchase-orders'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

// Scenario 29 PO-06 — full-replace edit (header + lines), same shape as
// updatePurchaseRequest. Editable while draft/approved/sent; the backend
// reverts an approved/sent PO to draft and voids the prior approval
// (PO-16) — this action doesn't need to know which case applied, it just
// PATCHes and lets the server decide.
export async function updatePurchaseOrder(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update purchase orders',
    }
  }

  const parsed = UpdatePoServerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>('/procurement/purchase-orders/' + id, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update purchase order',
      message: msg || errStr || 'Failed to update purchase order',
    }
  }

  revalidatePath('/inventory/purchase-orders')

  return {
    success: true,
    data: result.data,
    message: 'Purchase order updated successfully',
  }
}
