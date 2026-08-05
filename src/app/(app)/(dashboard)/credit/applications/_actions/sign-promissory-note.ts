'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PromissoryNote } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function signPromissoryNote(
  applicationId: string
): Promise<ApiResponse<PromissoryNote>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.PROMISSORY_NOTE_SIGN)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to sign a promissory note',
    }
  }

  const result = await api.post<PromissoryNote>(
    `/credit/applications/${applicationId}/promissory-note/sign`,
    {}
  )
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to sign promissory note'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath(`/credit/applications/${applicationId}`)
  revalidatePath('/pos/release-approvals')
  revalidatePath('/pos/checkout')

  return { success: true, data: result.data, message: 'Promissory note signed' }
}
