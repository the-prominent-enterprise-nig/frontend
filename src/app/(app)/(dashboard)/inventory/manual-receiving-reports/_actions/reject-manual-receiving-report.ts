'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { RejectManualReceivingReportFormValues } from '@/src/schema/inventory/manual-receiving-reports'

export async function rejectManualReceivingReport(
  id: string,
  data: RejectManualReceivingReportFormValues
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.MANUAL_RR_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to reject manual receiving reports',
    }
  }

  const result = await api.patch(`/inventory/manual-receiving-reports/${id}/reject`, data)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to reject',
      message: typeof result.message === 'string' ? result.message : 'Failed to reject',
    }
  }

  revalidatePath('/inventory/counting')

  return { success: true, data: result.data, message: 'Manual receiving report rejected' }
}
