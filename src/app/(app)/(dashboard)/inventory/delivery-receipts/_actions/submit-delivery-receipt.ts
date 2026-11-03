'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { DrStatus } from '@/src/schema/inventory/delivery-receipts'
import { drFailure } from '../_lib/dr-errors'

/** A memo purpose posts on submit (status posted); the rest wait for the
 * Branch Manager (pending_approval). */
export async function submitDeliveryReceipt(
  id: string
): Promise<ApiResponse<{ id: string; status: DrStatus }>> {
  const session = await getSessionOrNull()
  if (!session || !can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)) {
    return { success: false, error: 'Forbidden', message: 'You cannot submit delivery receipts' }
  }
  const result = await api.post<{ id: string; status: DrStatus }>(
    `/inventory/delivery-receipts/${id}/submit`
  )
  if (!result.success || !result.data) return drFailure(result, 'Failed to submit')
  revalidatePath('/inventory/stock-transaction')
  revalidatePath(`/inventory/delivery-receipts/${id}`)
  const { status } = result.data
  const message = status === 'posted' ? 'Submitted and posted' : 'Submitted for approval'
  return { success: true, data: { id, status }, message }
}
