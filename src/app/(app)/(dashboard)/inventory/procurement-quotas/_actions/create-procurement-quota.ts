'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type {
  CreateProcurementQuotaValues,
  ProcurementQuota,
} from '@/src/schema/inventory/procurement-quotas'

export async function createProcurementQuota(
  data: CreateProcurementQuotaValues
): Promise<ApiResponse<ProcurementQuota>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.QUOTA_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage procurement quotas',
    }
  }

  const result = await api.post<ProcurementQuota>('/procurement/quotas', data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create quota',
      message: msg || errStr || 'Failed to create quota',
    }
  }

  revalidatePath('/inventory/procurement-quotas')

  return { success: true, data: result.data, message: 'Spending quota created successfully' }
}
