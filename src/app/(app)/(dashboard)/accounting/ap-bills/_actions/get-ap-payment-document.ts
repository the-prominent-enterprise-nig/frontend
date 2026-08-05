'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

// Scenario 10 (Purchasing & AP) Part 5 — print-ready envelope for the
// cheque print action, mirroring get-purchase-order-document.ts's pattern.
export async function getApPaymentDocument(
  billId: string,
  paymentId: string
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, ACCOUNTING_PERMISSIONS.PAYMENT_READ)) {
    return { success: false, error: 'Forbidden', message: 'Insufficient permissions' }
  }

  return api.get<unknown>(`/ap-bills/${billId}/payments/${paymentId}/document`)
}
