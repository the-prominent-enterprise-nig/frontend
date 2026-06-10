'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateReturnFormSchema } from '@/src/schema/inventory/returns'

export async function createReturn(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateReturnFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
  }

  const result = await api.post<{ id: string }>('/inventory/stock/return', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to process return',
      message: msg || errStr || 'Failed to process return',
    }
  }

  revalidatePath('/inventory/returns')

  return {
    success: true,
    data: result.data,
    message: 'Return processed and stock balance updated',
  }
}
