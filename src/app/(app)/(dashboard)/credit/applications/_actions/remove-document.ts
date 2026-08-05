'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function removeCreditApplicationDocument(
  applicationId: string,
  documentId: string
): Promise<ApiResponse<null>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to remove documents from this credit application',
    }
  }

  const result = await api.delete(`/credit/applications/${applicationId}/documents/${documentId}`)
  if (!result.success) {
    const msg = typeof result.message === 'string' ? result.message : 'Failed to remove document'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath(`/credit/applications/${applicationId}`)

  return { success: true, data: null, message: 'Document removed' }
}
