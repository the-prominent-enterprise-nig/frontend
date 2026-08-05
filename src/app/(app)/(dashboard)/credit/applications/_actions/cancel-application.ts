'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CancelCreditApplicationFormSchema } from '@/src/schema/credit/applications'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function cancelCreditApplication(
  id: string,
  input: unknown
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_CANCEL)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to cancel this credit application',
    }
  }

  const parsed = CancelCreditApplicationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<CreditApplication>(
    `/credit/applications/${id}/cancel`,
    parsed.data
  )
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to cancel credit application'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath('/credit/applications')
  revalidatePath(`/credit/applications/${id}`)

  return { success: true, data: result.data, message: 'Credit application cancelled' }
}
