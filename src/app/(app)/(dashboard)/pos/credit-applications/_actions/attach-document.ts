'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { AttachCreditApplicationDocumentFormSchema } from '@/src/schema/credit/applications'
import type { CreditApplicationDocument } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function attachCreditApplicationDocument(
  applicationId: string,
  input: unknown
): Promise<ApiResponse<CreditApplicationDocument>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to attach documents to this credit application',
    }
  }

  const parsed = AttachCreditApplicationDocumentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<CreditApplicationDocument>(
    `/credit/applications/${applicationId}/documents`,
    parsed.data
  )
  if (!result.success) {
    const msg = typeof result.message === 'string' ? result.message : 'Failed to attach document'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath(`/pos/credit-applications/${applicationId}`)

  return { success: true, data: result.data, message: 'Document attached' }
}
