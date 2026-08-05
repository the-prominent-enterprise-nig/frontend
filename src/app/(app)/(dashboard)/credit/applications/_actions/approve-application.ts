'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function approveCreditApplication(
  id: string
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_APPROVE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to approve this credit application',
    }
  }

  const result = await api.patch<CreditApplication>(`/credit/applications/${id}/approve`, {})
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to approve credit application'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath('/credit/applications')
  revalidatePath(`/credit/applications/${id}`)

  return { success: true, data: result.data, message: 'Credit application approved' }
}
