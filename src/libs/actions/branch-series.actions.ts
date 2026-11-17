'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  BranchSeriesGapsListSchema,
  type BranchSeriesDoc,
  type BranchSeriesGaps,
} from '@/src/schema/inventory/branch-series'

/**
 * Numbers issued in a branch's RR / ST / DR series that no document holds.
 * A branch-assigned user gets their own branch; head office every branch
 * with a gap. Branches with nothing missing are left out.
 */
export async function getSeriesGaps(
  doc: BranchSeriesDoc
): Promise<ApiResponse<BranchSeriesGaps[]>> {
  const result = await api.get<BranchSeriesGaps[]>('/inventory/branch-series/gaps', { doc })
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Failed to check the series', message: '' }
  }
  const parsed = BranchSeriesGapsListSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid response from server', message: '' }
  }
  return { success: true, data: parsed.data, message: '' }
}
