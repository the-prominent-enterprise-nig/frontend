'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'

// The host branch ends its caravan by hand — early, or on its last day.
// From then on it counts as ended: no new stock in, its units can't be sold,
// and what's left shows up to be transferred out.
export async function closeCaravan(caravanId: string): Promise<ApiResponse<{ id: string }>> {
  const result = await api.post<{ id: string }>(`/inventory/caravans/${caravanId}/close`, {})

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to close the caravan',
      message: msg || errStr || 'Failed to close the caravan',
    }
  }

  revalidatePath('/inventory/transfers')
  return { success: true, data: result.data, message: 'Caravan closed' }
}
