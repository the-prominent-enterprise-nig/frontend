'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { CreateManualReceivingReportFormValues } from '@/src/schema/inventory/manual-receiving-reports'

export async function submitManualReceivingReport(
  data: CreateManualReceivingReportFormValues
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.MANUAL_RR_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to submit a manual receiving report',
    }
  }

  const result = await api.post('/inventory/manual-receiving-reports', data)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to submit manual receiving report',
      message:
        typeof result.message === 'string'
          ? result.message
          : 'Failed to submit manual receiving report',
    }
  }

  revalidatePath('/inventory/counting')

  return { success: true, data: result.data, message: 'Manual receiving report submitted' }
}
