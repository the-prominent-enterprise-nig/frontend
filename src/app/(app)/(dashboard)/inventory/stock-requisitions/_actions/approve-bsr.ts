'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function approveBsr(id: string, reservationDays?: number): Promise<ApiResponse<void>> {
  if (!id) return { success: false, error: 'Invalid ID', message: 'ID is required' }

  const body: Record<string, unknown> = {}
  if (reservationDays !== undefined) body.reservationDays = reservationDays

  const result = await api.post(`/inventory/stock-requisitions/${id}/approve`, body)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to approve requisition',
      message: msg || errStr || 'Failed to approve requisition',
    }
  }

  revalidatePath('/inventory/stock-requisitions')

  return { success: true, message: 'Requisition approved' }
}
