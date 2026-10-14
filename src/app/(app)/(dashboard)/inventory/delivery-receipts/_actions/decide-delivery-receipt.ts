'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { drFailure } from '../_lib/dr-errors'

async function canDecide(): Promise<boolean> {
  const session = await getSessionOrNull()
  return !!session && can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_APPROVE)
}

function revalidate(id: string): void {
  revalidatePath('/inventory/stock-transaction')
  revalidatePath(`/inventory/delivery-receipts/${id}`)
}

/** Branch Manager (or Business Owner) sign-off on a submitted DR. */
export async function approveDeliveryReceipt(id: string): Promise<ApiResponse<{ id: string }>> {
  if (!(await canDecide())) {
    return { success: false, error: 'Forbidden', message: 'You cannot approve delivery receipts' }
  }
  const result = await api.post(`/inventory/delivery-receipts/${id}/approve`)
  if (!result.success) return drFailure(result, 'Failed to approve')
  revalidate(id)
  return { success: true, data: { id }, message: 'Approved' }
}

export async function rejectDeliveryReceipt(
  id: string,
  reason: string
): Promise<ApiResponse<{ id: string }>> {
  if (!(await canDecide())) {
    return { success: false, error: 'Forbidden', message: 'You cannot reject delivery receipts' }
  }
  if (!reason.trim())
    return { success: false, error: 'Validation failed', message: 'Give a reason' }
  const result = await api.post(`/inventory/delivery-receipts/${id}/reject`, {
    reason: reason.trim(),
  })
  if (!result.success) return drFailure(result, 'Failed to reject')
  revalidate(id)
  return { success: true, data: { id }, message: 'Rejected' }
}
