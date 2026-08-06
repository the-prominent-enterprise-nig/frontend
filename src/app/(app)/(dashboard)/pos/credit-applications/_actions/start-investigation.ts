'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function startCreditInvestigation(
  id: string
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.INVESTIGATION_START)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to start a credit investigation',
    }
  }

  const result = await api.post<CreditApplication>(
    `/credit/applications/${id}/investigation/start`,
    {}
  )
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to start investigation'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath(`/pos/credit-applications/${id}`)

  return { success: true, data: result.data, message: 'Investigation started' }
}
