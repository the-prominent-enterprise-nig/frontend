'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

// The voucher for a whole payment transaction — one document listing every
// invoice the cheque settled. get-ap-payment-document.ts prints one invoice's
// share and is kept only for payments made through the retired per-bill route.
export async function getApDisbursementDocument(
  disbursementId: string
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, ACCOUNTING_PERMISSIONS.PAYMENT_READ)) {
    return { success: false, error: 'Forbidden', message: 'Insufficient permissions' }
  }

  return api.get<unknown>(`/ap-bills/disbursements/${disbursementId}/document`)
}
