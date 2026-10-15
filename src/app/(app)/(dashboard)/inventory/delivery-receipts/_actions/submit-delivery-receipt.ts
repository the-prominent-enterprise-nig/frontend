'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { drFailure } from '../_lib/dr-errors'

export async function submitDeliveryReceipt(id: string): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session || !can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot submit delivery receipts' }
  }
  const result = await api.post<{ id: string }>(`/inventory/delivery-receipts/${id}/submit`)
  if (!result.success || !result.data) return drFailure(result, 'Failed to submit')
  revalidatePath('/inventory/stock-transaction')
  revalidatePath(`/inventory/delivery-receipts/${id}`)
  return { success: true, data: { id }, message: 'Submitted for approval' }
}
