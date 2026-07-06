'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreatePurchaseRequestFormSchema } from '@/src/schema/inventory/purchase-requests'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export async function createPurchaseRequest(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create purchase requests',
    }
  }

  const parsed = CreatePurchaseRequestFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/procurement/purchase-requests', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create purchase request',
      message: msg || errStr || 'Failed to create purchase request',
    }
  }

  revalidatePath('/inventory/purchase-requests')

  return {
    success: true,
    data: result.data,
    message: 'Purchase request created successfully',
  }
}
