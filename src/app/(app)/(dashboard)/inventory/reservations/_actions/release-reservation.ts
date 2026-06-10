'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function releaseReservation(id: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.RESERVATIONS_RELEASE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to release reservations',
    }
  }

  const result = await api.post(`/inventory/reservations/${id}/release`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to release reservation',
      message: msg || errStr || 'Failed to release reservation',
    }
  }

  revalidatePath('/inventory/reservations')

  return { success: true, data: result.data, message: 'Reservation released' }
}
