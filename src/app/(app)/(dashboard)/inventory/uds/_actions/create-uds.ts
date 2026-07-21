'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateUdsFormSchema, type CreateUdsFormValues } from '@/src/schema/inventory/uds'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createUds(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.UDS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to issue UDS',
    }
  }

  const parsed = CreateUdsFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/uds', {
    ...parsed.data,
    expectedReturnDate: parsed.data.expectedReturnDate || undefined,
    warehouseId: parsed.data.warehouseId || undefined,
    rfsFormFileId: parsed.data.rfsFormFileId || undefined,
    repairProviderId: parsed.data.repairProviderId || undefined,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create UDS',
      message: msg || errStr || 'Failed to create UDS',
    }
  }

  revalidatePath('/inventory/uds')
  return { success: true, data: result.data, message: 'Unit Document Sheet issued successfully' }
}
