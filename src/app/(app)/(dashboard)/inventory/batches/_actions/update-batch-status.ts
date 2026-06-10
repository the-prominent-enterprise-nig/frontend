'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdateBatchStatusFormSchema } from '@/src/schema/inventory/batches'

export async function updateBatchStatus(id: string, input: unknown): Promise<ApiResponse<unknown>> {
  const parsed = UpdateBatchStatusFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/batches/${id}/status`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update batch status',
      message: msg || errStr || 'Failed to update batch status',
    }
  }

  revalidatePath('/inventory/batches')

  return { success: true, data: result.data, message: 'Batch status updated' }
}

export async function placeBatchHold(id: string, reason: string): Promise<ApiResponse<unknown>> {
  const result = await api.patch(`/inventory/batches/${id}/hold`, { reason })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to place hold',
      message: typeof result.message === 'string' ? result.message : 'Failed to place hold',
    }
  }

  revalidatePath('/inventory/batches')
  return { success: true, data: result.data, message: 'Quality hold placed on batch' }
}

export async function releaseBatchHold(id: string, reason: string): Promise<ApiResponse<unknown>> {
  const result = await api.patch(`/inventory/batches/${id}/release`, { reason })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to release hold',
      message: typeof result.message === 'string' ? result.message : 'Failed to release hold',
    }
  }

  revalidatePath('/inventory/batches')
  return { success: true, data: result.data, message: 'Quality hold released' }
}
