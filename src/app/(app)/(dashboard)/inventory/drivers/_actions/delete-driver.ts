'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function deleteDriver(id: string): Promise<ApiResponse<void>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.DRIVERS_DELETE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to delete drivers',
    }
  }

  const result = await api.delete(`/inventory/vehicles/drivers/${id}`)
  if (!result.success) {
    const msg = typeof result.message === 'string' ? result.message : ''
    return {
      success: false,
      error: String(result.error ?? 'Failed to delete driver'),
      message: msg || 'Failed to delete driver',
    }
  }

  revalidatePath('/inventory/master-data')
  return { success: true, message: 'Driver deleted' }
}
