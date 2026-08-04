'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

// Scenario 10 (Purchasing & AP) Part 7 — print-ready envelope for the PO PDF
// download action, mirroring get-receiving-document.ts's pattern.
export async function getPurchaseOrderDocument(poId: string): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) {
    return { success: false, error: 'Forbidden', message: 'Insufficient permissions' }
  }

  return api.get<unknown>(`/procurement/purchase-orders/${poId}/document`)
}
