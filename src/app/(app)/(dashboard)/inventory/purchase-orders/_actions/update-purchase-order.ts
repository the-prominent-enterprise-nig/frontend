'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdatePoServerSchema } from '@/src/schema/inventory/purchase-orders'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { poEditErrorMessage } from '../_lib/poEditRules'

// Scenario 29 PO-06 — edit header + lines. Draft/approved for anyone with
// the permission (an approved PO reverts to draft, PO-16); Head Office also
// sent/received ones. The server decides which applies and re-derives the
// status — this action just PATCHes.
export async function updatePurchaseOrder(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update purchase orders',
    }
  }

  const parsed = UpdatePoServerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  // The form calls a line's own id `lineId` (useFieldArray keys rows on `id`).
  const body = {
    ...parsed.data,
    // A line with every discount removed reaches here without the key at all;
    // send it as an empty chain so the server clears the saved discounts.
    lines: parsed.data.lines.map(({ lineId, ...line }) => ({
      ...line,
      discounts: line.discounts ?? [],
      id: lineId,
    })),
  }
  const result = await api.patch<{ id: string }>('/procurement/purchase-orders/' + id, body)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update purchase order',
      message: poEditErrorMessage(msg || errStr) || 'Failed to update purchase order',
    }
  }

  revalidatePath('/inventory/purchase-orders')

  return {
    success: true,
    data: result.data,
    message: 'Purchase order updated successfully',
  }
}
