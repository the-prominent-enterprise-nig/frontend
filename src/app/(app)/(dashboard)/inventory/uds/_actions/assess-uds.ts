'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { AssessUdsFormSchema } from '@/src/schema/inventory/uds'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function assessUds(id: string, input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.UDS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to assess UDS',
    }
  }

  const parsed = AssessUdsFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(`/inventory/uds/${id}/assess`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to assess UDS',
      message: msg || errStr || 'Failed to assess UDS',
    }
  }

  revalidatePath('/inventory/uds')
  return { success: true, data: result.data, message: 'UDS assessed' }
}
