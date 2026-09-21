'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

// Scenario 53 — no approval gate: the same person who drafted this report
// may post it, whenever ready. This is what actually originates serials,
// moves stock, and posts the GL entry.
export async function postManualReceivingReport(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (
    !canAny(session, [
      INVENTORY_PERMISSIONS.MANUAL_RR_CREATE,
      ACCOUNTING_PERMISSIONS.MANUAL_RR_CREATE,
    ])
  ) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to post a manual receiving report',
    }
  }

  const result = await api.patch(`/inventory/manual-receiving-reports/${id}/post`, {})

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to post',
      message: typeof result.message === 'string' ? result.message : 'Failed to post',
    }
  }

  revalidatePath('/accounting/receiving-reports')

  return { success: true, data: result.data, message: 'Manual receiving report posted' }
}
