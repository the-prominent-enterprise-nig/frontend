'use server'

import { api } from '@/src/libs/api/client'
import {
  PurchaseOrderSummarySchema,
  type PurchaseOrderSummary,
} from '@/src/schema/inventory/purchase-orders'

/**
 * One purchase order by id — for the `?po=<id>` deep link a converted PR's
 * "PO: <code>" reference opens. The list endpoint can't stand in for this:
 * the linked order may sit behind whatever status filter/page is currently
 * applied on this screen, or not be loaded at all yet.
 */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrderSummary | null> {
  const result = await api.get<unknown>(`/procurement/purchase-orders/${id}`)
  if (!result.success || !result.data) return null
  // The endpoint returns the record either bare or wrapped in `data`.
  const raw =
    typeof result.data === 'object' && result.data !== null && 'data' in result.data
      ? (result.data as { data: unknown }).data
      : result.data
  const parsed = PurchaseOrderSummarySchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
