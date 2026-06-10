'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { BatchSummary, BatchSummarySchema } from '@/src/schema/inventory/quality-hold'

export async function getQualityHold(id: string): Promise<ApiResponse<BatchSummary>> {
  if (!id) return { success: false, error: 'ID required', message: 'Batch ID is required' }

  const result = await api.get<BatchSummary>(`/inventory/batches/${id}`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load batch',
      message: typeof result.message === 'string' ? result.message : 'Failed to load batch',
    }
  }

  const parsed = BatchSummarySchema.safeParse(result.data)
  return { success: true, data: parsed.success ? parsed.data : (result.data as any) }
}
