'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { ApprovePrFormSchema } from '@/src/schema/inventory/purchase-requests'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export interface ApprovePurchaseRequestResult {
  id: string
  status: string
  // Set only when this approval was the final tier AND the PR already had
  // a supplier + fully priced lines, so the backend auto-converted it to a
  // real PO in the same request (PurchaseRequestService.approve()).
  convertedToPo: { id: string; code: string; status: string } | null
}

export async function approvePurchaseRequest(
  id: string,
  input: unknown
): Promise<ApiResponse<ApprovePurchaseRequestResult>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PR_APPROVE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to approve purchase requests',
    }
  }

  const parsed = ApprovePrFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<ApprovePurchaseRequestResult>(
    `/procurement/purchase-requests/${id}/approve`,
    parsed.data
  )

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to approve purchase request',
      message: msg || errStr || 'Failed to approve purchase request',
    }
  }

  revalidatePath('/inventory/purchase-orders')
  revalidatePath('/inventory/purchase-requests')

  return {
    success: true,
    data: result.data,
    message: 'Purchase request approved successfully',
  }
}
