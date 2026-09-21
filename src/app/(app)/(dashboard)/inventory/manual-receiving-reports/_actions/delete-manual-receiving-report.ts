'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

export async function deleteManualReceivingReport(id: string): Promise<ApiResponse<unknown>> {
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
      message: 'You do not have permission to delete a manual receiving report',
    }
  }

  const result = await api.delete(`/inventory/manual-receiving-reports/${id}`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to delete draft',
      message: typeof result.message === 'string' ? result.message : 'Failed to delete draft',
    }
  }

  revalidatePath('/accounting/receiving-reports')

  return { success: true, data: result.data, message: 'Draft deleted' }
}
