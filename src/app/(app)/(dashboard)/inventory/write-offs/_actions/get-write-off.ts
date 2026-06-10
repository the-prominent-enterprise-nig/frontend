'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { WriteOffSummary, WriteOffSummarySchema } from '@/src/schema/inventory/write-offs'

export async function getWriteOff(id: string): Promise<ApiResponse<WriteOffSummary>> {
  const result = await api.get<WriteOffSummary>(`/inventory/adjustments/${id}`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load write-off',
      message: typeof result.message === 'string' ? result.message : 'Failed to load write-off',
    }
  }

  const parsed = WriteOffSummarySchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: true, data: result.data }
  }

  return { success: true, data: parsed.data }
}
