'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type { CreateSalesQuotaValues, SalesQuota } from '@/src/schema/pos/sales-quotas'

export async function createSalesQuota(
  data: CreateSalesQuotaValues
): Promise<ApiResponse<SalesQuota>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.SALES_QUOTAS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage sales targets',
    }
  }

  const result = await api.post<SalesQuota>('/pos/sales-quotas', data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create sales target',
      message: msg || errStr || 'Failed to create sales target',
    }
  }

  revalidatePath('/pos/sales-quotas')

  return { success: true, data: result.data, message: 'Sales target created successfully' }
}
