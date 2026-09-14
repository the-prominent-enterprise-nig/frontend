'use server'

import { api } from '@/src/libs/api/client'
import {
  PurchaseRequestSummarySchema,
  type PurchaseRequestSummary,
} from '@/src/schema/inventory/purchase-requests'

/**
 * One purchase request by id.
 *
 * The list endpoint can't stand in for this: a PR that has been converted is
 * excluded from the default listing and, even on the Converted tab, may be
 * pages deep — so a link straight to a specific request (from the Source
 * column of the PO it became) has to fetch it on its own.
 */
export async function getPurchaseRequest(id: string): Promise<PurchaseRequestSummary | null> {
  const result = await api.get<unknown>(`/procurement/purchase-requests/${id}`)
  if (!result.success || !result.data) return null
  // The endpoint returns the record either bare or wrapped in `data`.
  const raw =
    typeof result.data === 'object' && result.data !== null && 'data' in result.data
      ? (result.data as { data: unknown }).data
      : result.data
  const parsed = PurchaseRequestSummarySchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
