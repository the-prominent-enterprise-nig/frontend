'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateBatchFormSchema } from '@/src/schema/inventory/batches'

export async function createBatch(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateBatchFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/batches', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create batch',
      message: msg || errStr || 'Failed to create batch',
    }
  }

  revalidatePath('/inventory/batches')

  return { success: true, data: result.data, message: 'Batch created successfully' }
}
