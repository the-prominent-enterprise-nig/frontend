'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdateCreditApplicationFormSchema } from '@/src/schema/credit/applications'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function updateCreditApplication(
  id: string,
  input: unknown
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to edit this credit application',
    }
  }

  const parsed = UpdateCreditApplicationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
    // Backend trusts this client-supplied price over its own Price List
    // resolution — see credit/applications schema's items.estimatedPrice comment.
    items: parsed.data.items?.map(({ itemId, estimatedPrice }) => ({
      itemId,
      unitPrice: estimatedPrice,
    })),
  }

  const result = await api.patch<CreditApplication>(`/credit/applications/${id}`, payload)
  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : 'Failed to update credit application'
    return { success: false, error: msg, message: msg }
  }

  revalidatePath('/pos/credit-applications')
  revalidatePath(`/pos/credit-applications/${id}`)

  return { success: true, data: result.data, message: 'Credit application updated' }
}
