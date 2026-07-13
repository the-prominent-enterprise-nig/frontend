'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { z } from 'zod'

const PoReceiptLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: z.object({ id: z.string(), sku: z.string(), name: z.string() }).nullable().optional(),
  purchaseOrderLineId: z.string().nullable().optional(),
  quantityReceived: z.number(),
  qtyOrdered: z.number(),
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  serialNumbers: z.array(z.string()).optional(),
  qualityHold: z.boolean(),
  notes: z.string().nullable().optional(),
})

const PoReceiptSchema = z.object({
  id: z.string(),
  code: z.string(),
  receivedAt: z.string(),
  notes: z.string().nullable().optional(),
  warehouse: z.object({ id: z.string(), name: z.string(), code: z.string() }).nullable().optional(),
  lines: z.array(PoReceiptLineSchema),
})

const PoReceiptsResponseSchema = z.object({
  data: z.array(PoReceiptSchema),
})

export type PoReceipt = z.infer<typeof PoReceiptSchema>
export type PoReceiptLine = z.infer<typeof PoReceiptLineSchema>

export async function getPurchaseOrderReceipts(
  poId: string
): Promise<ApiResponse<{ data: PoReceipt[] }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, PROCUREMENT_PERMISSIONS.PO_READ)) {
    return { success: false, error: 'Forbidden', message: 'Insufficient permissions' }
  }

  const result = await api.get<unknown>(`/procurement/purchase-orders/${poId}/receipts`)

  if (!result.success) {
    return {
      success: false,
      error: String(result.error ?? 'Failed to load receipts'),
      message: String(result.message ?? result.error ?? 'Failed to load receipts'),
    }
  }

  const parsed = PoReceiptsResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Parse error',
      message: 'Unexpected response shape from server',
    }
  }

  return { success: true, data: parsed.data }
}
