'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  ReceiveStockFormSchema,
  type ReceiveStockFormValues,
} from '@/src/schema/inventory/goods-receiving'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function receiveStock(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to receive stock',
    }
  }

  const parsed = ReceiveStockFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const {
    purchaseOrderNumber: _purchaseOrderNumber,
    purchaseOrderDate: _purchaseOrderDate,
    code,
    receivedAt,
    modeOfTransfer,
    lines,
    ...rest
  } = parsed.data

  const backendPayload = {
    ...rest,
    ...(code && code.trim() ? { code: code.trim() } : {}),
    ...(receivedAt && receivedAt.trim() ? { receivedAt: receivedAt.trim() } : {}),
    ...(modeOfTransfer && modeOfTransfer.trim() ? { modeOfTransfer: modeOfTransfer.trim() } : {}),
    lines: lines.map(({ itemId, expiryDate, batchNumber, autoGenerateSerials, ...lineRest }) => ({
      ...lineRest,
      itemId,
      ...(expiryDate ? { expiryDate } : {}),
      ...(batchNumber ? { batchNumber } : {}),
      ...(autoGenerateSerials ? { autoGenerateSerials: true } : {}),
    })),
  }

  const result = await api.post<{ id: string }>('/inventory/stock/receive', backendPayload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to receive stock',
      message: msg || errStr || 'Failed to receive stock',
    }
  }

  revalidatePath('/inventory/goods-receiving')

  return {
    success: true,
    data: result.data,
    message: 'Stock received and inventory updated successfully',
  }
}
