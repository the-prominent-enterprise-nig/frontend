'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { RecordCreditInvestigationFormSchema } from '@/src/schema/credit/applications'
import type { CreditInvestigation } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function recordCreditInvestigation(
  applicationId: string,
  input: unknown
): Promise<ApiResponse<CreditInvestigation>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.INVESTIGATION_RECORD)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to record a credit investigation outcome',
    }
  }

  const parsed = RecordCreditInvestigationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<CreditInvestigation>(
    `/credit/applications/${applicationId}/investigation`,
    parsed.data
  )
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to record investigation'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath(`/credit/applications/${applicationId}`)

  return { success: true, data: result.data, message: 'Investigation recorded' }
}
