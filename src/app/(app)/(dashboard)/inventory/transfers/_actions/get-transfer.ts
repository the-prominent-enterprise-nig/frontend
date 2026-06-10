'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { TransferSummary, TransferSummarySchema } from '@/src/schema/inventory/transfers'

export async function getTransfer(id: string): Promise<ApiResponse<TransferSummary>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  try {
    const result = await api.get<TransferSummary>(`/inventory/transfers/${id}`)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch transfer',
        message: result.message,
      }
    }

    const validated = TransferSummarySchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as TransferSummary }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching transfer:', error)
    return {
      success: false,
      error: 'Failed to fetch transfer',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
