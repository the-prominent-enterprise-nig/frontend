'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export async function deleteVehicle(id: string): Promise<ApiResponse<void>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!canAny(session, DRIVER_ACCESS.DELETE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to delete vehicles',
    }
  }

  const result = await api.delete(`/inventory/vehicles/${id}`)
  if (!result.success) {
    const msg = typeof result.message === 'string' ? result.message : ''
    return {
      success: false,
      error: String(result.error ?? 'Failed to delete vehicle'),
      message: msg || 'Failed to delete vehicle',
    }
  }

  revalidatePath('/accounting/vehicles')
  return { success: true, message: 'Vehicle deleted' }
}
