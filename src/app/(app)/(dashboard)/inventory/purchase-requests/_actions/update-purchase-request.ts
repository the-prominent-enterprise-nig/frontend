'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdatePurchaseRequestFormSchema } from '@/src/schema/inventory/purchase-requests'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export async function updatePurchaseRequest(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update purchase requests',
    }
  }

  const parsed = UpdatePurchaseRequestFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(
    '/procurement/purchase-requests/' + id,
    parsed.data
  )

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update purchase request',
      message: msg || errStr || 'Failed to update purchase request',
    }
  }

  revalidatePath('/inventory/purchase-requests')

  return {
    success: true,
    data: result.data,
    message: 'Purchase request updated successfully',
  }
}
