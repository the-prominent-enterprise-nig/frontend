'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { drFailure } from '../_lib/dr-errors'

export async function deleteDeliveryReceipt(id: string): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session || !can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_UPDATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot delete delivery receipts' }
  }
  const result = await api.delete<{ id: string }>(`/inventory/delivery-receipts/${id}`)
  if (!result.success) return drFailure(result, 'Failed to delete the draft')
  revalidatePath('/inventory/stock-transaction')
  return { success: true, data: { id }, message: 'Draft deleted' }
}
